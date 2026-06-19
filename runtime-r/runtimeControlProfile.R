qca_error <- function(code) {
    list(ok = FALSE, error = as.character(code))
}


qca_dataset <- function(name) {
    dataset_name <- as.character(name %||% "")

    if (!nzchar(dataset_name)) return(qca_error("missing-workspace-name"))

    if (!exists(dataset_name, envir = .GlobalEnv, inherits = FALSE)) {
        return(qca_error("workspace-object-not-found"))
    }

    value <- tryCatch(
        get(dataset_name, envir = .GlobalEnv, inherits = FALSE),
        error = function(error) error
    )

    if (inherits(value, "error")) return(qca_error(conditionMessage(value)))
    if (!is.data.frame(value)) return(qca_error("workspace-object-not-dataset"))

    list(ok = TRUE, name = dataset_name, value = value)
}


qca_numeric_column <- function(dataset, variable_name) {
    name <- as.character(variable_name %||% "")

    if (!nzchar(name)) return(qca_error("missing-workspace-variable-name"))

    if (!is.element(name, names(dataset))) {
        return(qca_error("workspace-dataset-variable-not-found"))
    }

    value <- tryCatch(dataset[[name]], error = function(error) error)

    if (inherits(value, "error")) return(qca_error(conditionMessage(value)))

    if (inherits(value, "declared") && requireNamespace("declared", quietly = TRUE)) {
        value <- tryCatch(
            declared::undeclare(value, drop = TRUE),
            error = function(error) value
        )
    }

    list(
        ok = TRUE,
        name = name,
        values = suppressWarnings(as.numeric(as.character(value)))
    )
}


qca_numeric_json <- function(values) {
    if (!length(values)) return("[]")

    encoded <- vapply(values, function(value) {
        if (!is.finite(value) || is.na(value)) return("null")

        json_num(value)
    }, character(1))

    paste0("[", paste(encoded, collapse = ","), "]")
}


qca_string_matrix_json <- function(rows) {
    if (!length(rows)) return("[]")

    encoded <- vapply(rows, function(row) {
        json_strv(as.character(row %||% character(0)))
    }, character(1))

    paste0("[", paste(encoded, collapse = ","), "]")
}


qca_calibration_thresholds <- function(params) {
    if (!requireNamespace("QCA", quietly = TRUE)) {
        return(qca_error("package-qca-not-installed"))
    }

    dataset <- qca_dataset(params$name)

    if (!isTRUE(dataset$ok)) return(dataset)

    column <- qca_numeric_column(dataset$value, params$variableName)

    if (!isTRUE(column$ok)) return(column)

    values <- column$values[is.finite(column$values) & !is.na(column$values)]

    if (!length(values)) {
        return(list(
            ok = TRUE,
            result = list(isNumeric = FALSE, thresholds = numeric(0)),
            result_json = "{\"isNumeric\": false, \"thresholds\": []}"
        ))
    }

    count <- suppressWarnings(as.integer(params$nth %||% params$count %||% 1L))

    if (!is.finite(count) || is.na(count) || count < 1L) count <- 1L
    if (count > 6L) count <- 6L

    thresholds <- tryCatch(
        QCA::findTh(values, n = count),
        error = function(error) error
    )

    if (inherits(thresholds, "error")) {
        return(qca_error(conditionMessage(thresholds)))
    }

    thresholds <- suppressWarnings(as.numeric(as.character(thresholds)))
    thresholds <- thresholds[is.finite(thresholds) & !is.na(thresholds)]

    if (length(thresholds) < count) {
        probabilities <- seq_len(count) / (count + 1)
        fallback <- tryCatch(
            stats::quantile(
                values,
                probs = probabilities,
                na.rm = TRUE,
                names = FALSE,
                type = 7
            ),
            error = function(error) numeric(0)
        )
        fallback <- suppressWarnings(as.numeric(fallback))
        fallback <- fallback[is.finite(fallback) & !is.na(fallback)]
        thresholds <- sort(c(thresholds, fallback))
    }

    if (length(thresholds) > count) {
        thresholds <- thresholds[seq_len(count)]
    }

    if (length(thresholds) < count && length(thresholds)) {
        thresholds <- c(
            thresholds,
            rep(thresholds[[length(thresholds)]], count - length(thresholds))
        )
    }

    if (!length(thresholds)) {
        thresholds <- rep(stats::median(values, na.rm = TRUE), count)
    }

    result <- list(isNumeric = TRUE, thresholds = thresholds)
    result_json <- paste0(
        "{",
        "\"isNumeric\": true,",
        "\"thresholds\": ", qca_numeric_json(thresholds),
        "}"
    )

    list(ok = TRUE, result = result, result_json = result_json)
}


qca_calibration_arguments <- function(params, values) {
    thresholds <- suppressWarnings(as.numeric(as.character(
        params$thresholds %||% numeric(0)
    )))
    thresholds <- thresholds[is.finite(thresholds)]
    variant <- tolower(trimws(as.character(params$variant %||% "fuzzy")))
    bell <- isTRUE(params$bell)
    required_count <- if (identical(variant, "crisp")) {
        max(1L, length(thresholds))
    } else if (bell) {
        6L
    } else {
        3L
    }

    if (length(thresholds) < required_count) {
        return(qca_error("insufficient-thresholds"))
    }

    if (identical(variant, "crisp")) {
        threshold_argument <- if (length(thresholds) == 1L) {
            thresholds[[1L]]
        } else {
            thresholds
        }
    } else {
        threshold_names <- as.character(params$thresholdNames %||% character(0))
        threshold_names <- threshold_names[
            seq_len(min(length(threshold_names), length(thresholds)))
        ]

        if (!length(threshold_names)) {
            threshold_names <- if (bell) {
                c("e1", "c1", "i1", "i2", "c2", "e2")
            } else {
                c("e", "c", "i")
            }
        }

        threshold_argument <- paste(
            paste0(
                threshold_names[seq_len(length(thresholds))],
                "=",
                thresholds
            ),
            collapse = ", "
        )
    }

    arguments <- list(values, thresholds = threshold_argument)

    if (identical(variant, "crisp")) {
        arguments$type <- "crisp"
        return(list(ok = TRUE, value = arguments))
    }

    if (!isTRUE(params$logistic)) arguments$logistic <- FALSE
    if (isTRUE(params$ecdf)) arguments$ecdf <- TRUE

    idm <- suppressWarnings(as.numeric(params$idm %||% NA_real_))
    below <- suppressWarnings(as.numeric(params$below %||% 1))
    above <- suppressWarnings(as.numeric(params$above %||% 1))

    if (isTRUE(params$logistic) && is.finite(idm) && !is.na(idm)) {
        arguments$idm <- idm
    }

    if (is.finite(below) && !is.na(below)) arguments$below <- below
    if (is.finite(above) && !is.na(above)) arguments$above <- above

    list(ok = TRUE, value = arguments)
}


qca_calibration_preview <- function(params) {
    if (!requireNamespace("QCA", quietly = TRUE)) {
        return(qca_error("package-qca-not-installed"))
    }

    dataset <- qca_dataset(params$name)

    if (!isTRUE(dataset$ok)) return(dataset)

    column <- qca_numeric_column(dataset$value, params$variableName)

    if (!isTRUE(column$ok)) return(column)

    if (!length(column$values)) {
        return(list(
            ok = TRUE,
            result = list(values = numeric(0), rowNames = character(0)),
            result_json = "{\"values\": [], \"rowNames\": []}"
        ))
    }

    arguments <- qca_calibration_arguments(params, column$values)

    if (!isTRUE(arguments$ok)) return(arguments)

    preview <- tryCatch(
        do.call(QCA::calibrate, arguments$value),
        error = function(error) error
    )

    if (inherits(preview, "error")) {
        return(qca_error(conditionMessage(preview)))
    }

    row_names <- rownames(dataset$value)

    if (is.null(row_names) || length(row_names) != length(column$values)) {
        row_names <- as.character(seq_along(column$values))
    }

    values <- suppressWarnings(as.numeric(as.character(preview)))
    result <- list(values = values, rowNames = as.character(row_names))
    result_json <- paste0(
        "{\"values\": ", qca_numeric_json(values),
        ",\"rowNames\": ", json_strv(result$rowNames),
        "}"
    )

    list(ok = TRUE, result = result, result_json = result_json)
}


qca_fit_triplet <- function(x, y, relation) {
    fit <- tryCatch(QCA::pof(x, y, rel = relation), error = function(error) error)

    if (inherits(fit, "error")) {
        return(c(NA_character_, NA_character_, NA_character_))
    }

    values <- if (identical(relation, "suf")) {
        c(fit$incl.cov$inclS, fit$incl.cov$covS, fit$incl.cov$PRI)
    } else {
        c(fit$incl.cov$inclN, fit$incl.cov$covN, fit$incl.cov$RoN)
    }

    formatC(values, format = "f", digits = 3)
}


qca_xyplot_preview <- function(params) {
    if (!requireNamespace("QCA", quietly = TRUE)) {
        return(qca_error("package-qca-not-installed"))
    }

    dataset <- qca_dataset(params$name)

    if (!isTRUE(dataset$ok)) return(dataset)

    x <- qca_numeric_column(dataset$value, params$xVariableName)
    y <- qca_numeric_column(dataset$value, params$yVariableName)

    if (!isTRUE(x$ok)) return(x)
    if (!isTRUE(y$ok)) return(y)

    row_names <- rownames(dataset$value)

    if (is.null(row_names) || length(row_names) != length(x$values)) {
        row_names <- as.character(seq_along(x$values))
    }

    keep <- is.finite(x$values) & !is.na(x$values) &
        is.finite(y$values) & !is.na(y$values)
    x_values <- x$values[keep]
    y_values <- y$values[keep]
    labels <- as.character(row_names)[keep]
    not_x <- 1 - x_values
    not_y <- 1 - y_values
    sufficiency <- list(
        qca_fit_triplet(x_values, y_values, "suf"),
        qca_fit_triplet(not_x, y_values, "suf"),
        qca_fit_triplet(x_values, not_y, "suf"),
        qca_fit_triplet(not_x, not_y, "suf")
    )
    necessity <- list(
        qca_fit_triplet(x_values, y_values, "nec"),
        qca_fit_triplet(not_x, y_values, "nec"),
        qca_fit_triplet(x_values, not_y, "nec"),
        qca_fit_triplet(not_x, not_y, "nec")
    )
    result <- list(
        labels = labels,
        x = x_values,
        y = y_values,
        sufficiency = sufficiency,
        necessity = necessity
    )
    result_json <- paste0(
        "{\"labels\":", json_strv(labels),
        ",\"x\":", qca_numeric_json(x_values),
        ",\"y\":", qca_numeric_json(y_values),
        ",\"sufficiency\":", qca_string_matrix_json(sufficiency),
        ",\"necessity\":", qca_string_matrix_json(necessity),
        "}"
    )

    list(ok = TRUE, result = result, result_json = result_json)
}


qca_truth_table_rows <- function(object) {
    table <- tryCatch(object$tt %||% list(), error = function(error) list())
    options <- tryCatch(object$options %||% list(), error = function(error) list())
    conditions <- as.character(options$conditions %||% character(0))

    if (isTRUE(options$use.letters) && length(conditions)) {
        conditions <- LETTERS[seq_along(conditions)]
    }

    data <- tryCatch({
        if (!is.null(dim(table)) && length(colnames(table) %||% character(0))) {
            as.data.frame(table, stringsAsFactors = FALSE)
        } else {
            NULL
        }
    }, error = function(error) NULL)

    ids <- tryCatch({
        if (!is.null(object$id) && length(object$id)) {
            as.character(object$id)
        } else if (
            !is.null(data) &&
            length(conditions) &&
            all(is.element(conditions, colnames(data)))
        ) {
            apply(data[, conditions, drop = FALSE], 1, function(row) {
                if (any(row == 1)) paste(which(row == 1), collapse = "") else "0"
            })
        } else {
            as.character(rownames(data) %||% rownames(table) %||% character(0))
        }
    }, error = function(error) character(0))

    out <- tryCatch({
        if (!is.null(data) && is.element("OUT", colnames(data))) {
            as.character(data[, "OUT", drop = TRUE])
        } else if (!is.null(table$OUT)) {
            as.character(table$OUT)
        } else if (!is.null(object$OUT)) {
            as.character(object$OUT)
        } else {
            character(0)
        }
    }, error = function(error) character(0))

    cases <- tryCatch({
        if (!is.null(data) && is.element("cases", colnames(data))) {
            as.character(data[, "cases", drop = TRUE])
        } else {
            as.character(table$cases %||% object$cases %||% character(0))
        }
    }, error = function(error) character(0))

    list(id = ids, out = out, cases = cases)
}


qca_truth_table_json <- function(item) {
    options <- item$options %||% list()
    inclusion <- as.character(options$incl.cut %||% character(0))
    inclusion_one <- if (length(inclusion) >= 1L) inclusion[[1L]] else ""
    inclusion_zero <- if (length(inclusion) >= 2L) inclusion[[2L]] else ""

    paste0(
        "{\"name\":", json_str(item$name),
        ",\"options\":{",
        "\"outcome\":", json_str(as.character(options$outcome %||% "")),
        ",\"conditions\":", json_str(paste(
            as.character(options$conditions %||% character(0)),
            collapse = ","
        )),
        ",\"incl1\":", json_str(inclusion_one),
        ",\"incl0\":", json_str(inclusion_zero),
        ",\"priCut\":", json_str(as.character(options$pri.cut %||% "")),
        ",\"nCut\":", json_str(as.character(options$n.cut %||% "")),
        ",\"negOut\":", json_bool(isTRUE(options$neg.out)),
        ",\"showCases\":", json_bool(isTRUE(options$show.cases)),
        ",\"useLetters\":", json_bool(isTRUE(options$use.letters)),
        "},\"id\":", json_strv(item$id),
        ",\"out\":", json_strv(item$out),
        ",\"cases\":", json_strv(item$cases),
        "}"
    )
}


qca_truth_tables <- function() {
    object_names <- tryCatch(
        ls(envir = .GlobalEnv, all.names = TRUE),
        error = function(error) character(0)
    )
    result <- list()

    for (object_name in object_names) {
        object <- tryCatch(
            get(object_name, envir = .GlobalEnv, inherits = FALSE),
            error = function(error) NULL
        )

        if (is.null(object)) next

        classes <- tryCatch(
            as.character(class(object)),
            error = function(error) character(0)
        )

        if (!any(is.element(classes, c("QCA_tt", "tt")))) next

        rows <- qca_truth_table_rows(object)
        result[[length(result) + 1L]] <- list(
            name = object_name,
            options = tryCatch(
                object$options %||% list(),
                error = function(error) list()
            ),
            id = rows$id,
            out = rows$out,
            cases = rows$cases
        )
    }

    result_json <- if (length(result)) {
        paste0(
            "[",
            paste(vapply(result, qca_truth_table_json, character(1)), collapse = ","),
            "]"
        )
    } else {
        "[]"
    }

    list(ok = TRUE, result = result, result_json = result_json)
}


runtime_dispatch_product_method <- function(method, params) {
    switch(method,
        "workspace.truth_tables" = qca_truth_tables(),
        "workspace.dataset_calibrate_thresholds" = qca_calibration_thresholds(params),
        "workspace.dataset_calibrate_preview" = qca_calibration_preview(params),
        "workspace.dataset_xyplot_preview" = qca_xyplot_preview(params),
        NULL
    )
}
