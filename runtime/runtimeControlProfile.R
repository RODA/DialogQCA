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


qca_fiss_solution_names <- function() {
    object_names <- tryCatch(
        ls(envir = .GlobalEnv, all.names = TRUE),
        error = function(error) character(0)
    )

    object_names[vapply(object_names, function(object_name) {
        object <- tryCatch(
            get(object_name, envir = .GlobalEnv, inherits = FALSE),
            error = function(error) NULL
        )

        inherits(object, "QCA_min") && length(object$i.sol)
    }, logical(1))]
}


qca_fiss_named_strings <- function(value) {
    if (is.null(value)) return(character(0))

    if (is.list(value)) {
        output <- vapply(value, function(entry) {
            as.character(entry %||% "")[[1L]]
        }, character(1))
        names(output) <- names(value)
        return(output)
    }

    output <- as.character(value)
    names(output) <- names(value)
    output
}


qca_fiss_named_json <- function(value) {
    if (!length(value)) return("{}")

    entries <- vapply(seq_along(value), function(index) {
        paste0(
            json_str(names(value)[index]), ":",
            json_str(as.character(value[index]))
        )
    }, character(1))

    paste0("{", paste(entries, collapse = ","), "}")
}


qca_fiss_candidates_json <- function(candidates) {
    if (!length(candidates)) return("[]")

    entries <- vapply(seq_along(candidates), function(index) {
        paste0(
            "{\"configuration\":", json_str(names(candidates)[index]),
            ",\"terms\":", json_strv(as.character(candidates[[index]])),
            "}"
        )
    }, character(1))

    paste0("[", paste(entries, collapse = ","), "]")
}


qca_fiss_chart <- function(
    object, branch, model, parsimonious = NULL, resolve = NULL
) {
    arguments <- list(
        x = object,
        branch = branch,
        model = model
    )

    if (!is.null(parsimonious)) {
        arguments$parsimonious <- parsimonious
    }

    if (
        !is.null(resolve) &&
        is.element("resolve", names(formals(QCA::fissChart)))
    ) {
        arguments$resolve <- resolve
    }

    do.call(QCA::fissChart, arguments)
}


qca_fiss_condition_labels <- function(
    object, chart, use.labels = isTRUE(object$tt$options$use.labels)
) {
    conditions <- rownames(chart$values)

    if (!use.labels) return(conditions)

    categories <- object$tt$categories %||% list()
    vapply(conditions, function(condition) {
        values <- as.character(categories[[condition]] %||% character(0))
        if (length(values) >= 2L && nzchar(values[[2L]])) {
            values[[2L]]
        }
        else {
            condition
        }
    }, character(1))
}


qca_fiss_outcome_label <- function(object, chart) {
    label <- as.character(chart$outcome.label %||% "")[[1L]]
    if (nzchar(label)) return(label)

    outcome <- as.character(chart$outcome %||% object$tt$options$outcome %||% "")[[1L]]
    if (isTRUE(object$tt$options$use.labels)) {
        categories <- as.character(
            (object$tt$categories %||% list())[[outcome]] %||% character(0)
        )
        index <- if (isTRUE(chart$neg.out)) 1L else 2L
        if (length(categories) >= index && nzchar(categories[[index]])) {
            return(categories[[index]])
        }
    }

    paste0(if (isTRUE(chart$neg.out)) "~" else "", outcome)
}


qca_fiss_plot_command <- function(
    object_name, branch, model, chart, title, legend, labels
) {
    quote_r <- function(value) {
        encodeString(as.character(value), quote = "\"")
    }
    object_reference <- paste(
        deparse(as.name(object_name), width.cutoff = 500L),
        collapse = ""
    )
    chart_args <- c(
        object_reference,
        paste0("branch = ", quote_r(branch)),
        paste0("model = ", model)
    )
    ambiguous <- lengths(chart$candidates) > 1L

    if (any(ambiguous)) {
        selected <- unname(chart$parsimonious)
        chart_args <- c(
            chart_args,
            paste0(
                "parsimonious = c(",
                paste(vapply(selected, quote_r, character(1)), collapse = ", "),
                ")"
            )
        )
    }

    plot_args <- c(
        paste0("fissChart(", paste(chart_args, collapse = ", "), ")"),
        paste0("labels = c(", paste(vapply(labels, quote_r, character(1)), collapse = ", "), ")"),
        paste0("main = ", quote_r(title)),
        paste0("legend = ", if (legend) "TRUE" else "FALSE")
    )

    paste0("plot(", paste(plot_args, collapse = ", "), ")")
}


qca_fiss_dialog_state <- function(params) {
    solution_names <- qca_fiss_solution_names()
    selected_solution <- trimws(as.character(
        params$solutionName %||% params$name %||% ""
    ))

    if (!is.element(selected_solution, solution_names)) {
        selected_solution <- if (length(solution_names)) {
            solution_names[[length(solution_names)]]
        } else {
            ""
        }
    }

    requested_title <- as.character(params$title %||% "")[[1L]]

    empty_result <- function(message = "") {
        result <- list(
            solutionNames = solution_names,
            selectedSolution = selected_solution,
            branches = character(0),
            selectedBranch = "",
            models = character(0),
            selectedModel = "",
            ambiguities = list(),
            selectedAmbiguity = "",
            coreCandidates = character(0),
            selectedCoreTerm = "",
            coreSelections = character(0),
            title = requested_title,
            legend = isTRUE(params$legend),
            useLabels = isTRUE(params$useLabels),
            command = "",
            message = message,
            renderPayload = list(
                kind = "fiss",
                title = requested_title,
                conditions = character(0),
                configurations = character(0),
                expressions = character(0),
                values = list(),
                roles = list(),
                fit = list(),
                solutionFit = numeric(0),
                legend = isTRUE(params$legend),
                message = message
            )
        )

        result_json <- paste0(
            "{\"solutionNames\":", json_strv(result$solutionNames),
            ",\"selectedSolution\":", json_str(result$selectedSolution),
            ",\"branches\":[],\"selectedBranch\":\"\",",
            "\"models\":[],\"selectedModel\":\"\",",
            "\"ambiguities\":[],\"selectedAmbiguity\":\"\",",
            "\"coreCandidates\":[],\"selectedCoreTerm\":\"\",",
            "\"coreSelections\":{},\"title\":", json_str(requested_title), ",",
            "\"legend\":", json_bool(result$legend),
            ",\"useLabels\":", json_bool(result$useLabels),
            ",\"command\":\"\",\"message\":", json_str(message),
            ",\"renderPayload\":{\"kind\":\"fiss\",\"title\":",
            json_str(requested_title), ",",
            "\"conditions\":[],\"configurations\":[],\"expressions\":[],",
            "\"values\":[],\"roles\":[],\"fit\":[],\"solutionFit\":[],",
            "\"legend\":", json_bool(result$legend),
            ",\"message\":", json_str(message), "}}"
        )

        list(ok = TRUE, result = result, result_json = result_json)
    }

    if (!nzchar(selected_solution)) {
        return(empty_result("Create an intermediate QCA solution before opening a Fiss chart."))
    }

    if (
        !requireNamespace("QCA", quietly = TRUE) ||
        !exists("fissChart", envir = asNamespace("QCA"), inherits = FALSE)
    ) {
        return(empty_result("This dialog requires a QCA version that provides fissChart()."))
    }

    object <- tryCatch(
        get(selected_solution, envir = .GlobalEnv, inherits = FALSE),
        error = function(error) NULL
    )
    branches <- names(object$i.sol %||% list())
    selected_branch <- trimws(as.character(params$branch %||% ""))
    if (!is.element(selected_branch, branches)) {
        selected_branch <- if (length(branches)) branches[[1L]] else ""
    }

    branch_solution <- object$i.sol[[selected_branch]]
    models <- branch_solution$solution %||% list()
    if (!is.list(models)) models <- list(models)
    model_names <- paste0("M", seq_along(models))
    selected_model <- trimws(as.character(params$model %||% ""))
    if (!is.element(selected_model, model_names)) {
        selected_model <- if (length(model_names)) model_names[[1L]] else ""
    }
    model_index <- match(selected_model, model_names)

    preview <- tryCatch(
        qca_fiss_chart(
            object,
            branch = selected_branch,
            model = model_index,
            resolve = "first"
        ),
        error = function(error) error
    )
    if (inherits(preview, "error")) {
        state <- empty_result(conditionMessage(preview))
        state$result$branches <- branches
        state$result$selectedBranch <- selected_branch
        state$result$models <- model_names
        state$result$selectedModel <- selected_model
        state$result_json <- sub(
            "\"branches\":[],\"selectedBranch\":\"\",\"models\":[],\"selectedModel\":\"\"",
            paste0(
                "\"branches\":", json_strv(branches),
                ",\"selectedBranch\":", json_str(selected_branch),
                ",\"models\":", json_strv(model_names),
                ",\"selectedModel\":", json_str(selected_model)
            ),
            state$result_json,
            fixed = TRUE
        )
        return(state)
    }

    core_selections <- qca_fiss_named_strings(params$coreSelections)
    selected_terms <- preview$parsimonious
    for (configuration in names(preview$candidates)) {
        proposed <- if (is.element(configuration, names(core_selections))) {
            core_selections[[configuration]]
        } else {
            ""
        }
        if (is.element(proposed, preview$candidates[[configuration]])) {
            selected_terms[[configuration]] <- proposed
        }
    }

    chart <- qca_fiss_chart(
        object,
        branch = selected_branch,
        model = model_index,
        parsimonious = selected_terms
    )
    core_selections <- chart$parsimonious
    ambiguous <- chart$candidates[lengths(chart$candidates) > 1L]
    ambiguous_names <- names(ambiguous)
    selected_ambiguity <- trimws(as.character(params$ambiguity %||% ""))
    if (!is.element(selected_ambiguity, ambiguous_names)) {
        selected_ambiguity <- if (length(ambiguous_names)) ambiguous_names[[1L]] else ""
    }
    core_candidates <- if (nzchar(selected_ambiguity)) {
        ambiguous[[selected_ambiguity]]
    } else {
        character(0)
    }
    selected_core <- if (nzchar(selected_ambiguity)) {
        chart$parsimonious[[selected_ambiguity]]
    } else {
        ""
    }
    title <- requested_title
    if (!nzchar(trimws(title))) {
        title <- paste0("Configurations for ", qca_fiss_outcome_label(object, chart))
    }
    legend <- isTRUE(params$legend)
    use_labels <- if (is.null(params$useLabels)) {
        isTRUE(object$tt$options$use.labels)
    } else {
        isTRUE(params$useLabels)
    }
    condition_labels <- qca_fiss_condition_labels(object, chart, use_labels)
    configurations <- colnames(chart$values)
    configuration_labels <- as.character(seq_along(configurations))
    fit <- lapply(seq_along(configurations), function(index) {
        row <- chart$fit[index, , drop = FALSE]
        c(
            consistency = as.numeric(row$inclS),
            rawCoverage = as.numeric(row$covS),
            uniqueCoverage = as.numeric(row$covU)
        )
    })
    solution_fit <- c(
        consistency = as.numeric(chart$solution.fit$inclS[[1L]]),
        coverage = as.numeric(chart$solution.fit$covS[[1L]])
    )
    command <- qca_fiss_plot_command(
        selected_solution,
        selected_branch,
        model_index,
        chart,
        title,
        legend,
        condition_labels
    )
    message <- if (length(ambiguous)) {
        "Review the core term for each ambiguous configuration."
    } else {
        "Core conditions have a unique parsimonious match."
    }
    values <- lapply(seq_len(nrow(chart$values)), function(index) {
        unname(chart$values[index, ])
    })
    roles <- lapply(seq_len(nrow(chart$roles)), function(index) {
        unname(chart$roles[index, ])
    })
    render_payload <- list(
        kind = "fiss",
        title = title,
        conditions = condition_labels,
        configurations = configuration_labels,
        expressions = configurations,
        values = values,
        roles = roles,
        fit = fit,
        solutionFit = solution_fit,
        legend = legend,
        message = ""
    )
    fit_json <- if (length(fit)) {
        paste0("[", paste(vapply(fit, function(row) {
            paste0(
                "{\"consistency\":", json_num(row[["consistency"]]),
                ",\"rawCoverage\":", json_num(row[["rawCoverage"]]),
                ",\"uniqueCoverage\":",
                if (is.na(row[["uniqueCoverage"]])) "null" else json_num(row[["uniqueCoverage"]]),
                "}"
            )
        }, character(1)), collapse = ","), "]")
    } else {
        "[]"
    }
    payload_json <- paste0(
        "{\"kind\":\"fiss\",\"title\":", json_str(title),
        ",\"conditions\":", json_strv(render_payload$conditions),
        ",\"configurations\":", json_strv(configuration_labels),
        ",\"expressions\":", json_strv(configurations),
        ",\"values\":", qca_string_matrix_json(values),
        ",\"roles\":", qca_string_matrix_json(roles),
        ",\"fit\":", fit_json,
        ",\"solutionFit\":{\"consistency\":", json_num(solution_fit[["consistency"]]),
        ",\"coverage\":", json_num(solution_fit[["coverage"]]), "}",
        ",\"legend\":", json_bool(legend),
        ",\"message\":\"\"}"
    )
    result <- list(
        solutionNames = solution_names,
        selectedSolution = selected_solution,
        branches = branches,
        selectedBranch = selected_branch,
        models = model_names,
        selectedModel = selected_model,
        ambiguities = ambiguous,
        selectedAmbiguity = selected_ambiguity,
        coreCandidates = core_candidates,
        selectedCoreTerm = selected_core,
        coreSelections = core_selections,
        title = title,
        legend = legend,
        useLabels = use_labels,
        command = command,
        message = message,
        renderPayload = render_payload
    )
    result_json <- paste0(
        "{\"solutionNames\":", json_strv(solution_names),
        ",\"selectedSolution\":", json_str(selected_solution),
        ",\"branches\":", json_strv(branches),
        ",\"selectedBranch\":", json_str(selected_branch),
        ",\"models\":", json_strv(model_names),
        ",\"selectedModel\":", json_str(selected_model),
        ",\"ambiguities\":", qca_fiss_candidates_json(ambiguous),
        ",\"selectedAmbiguity\":", json_str(selected_ambiguity),
        ",\"coreCandidates\":", json_strv(core_candidates),
        ",\"selectedCoreTerm\":", json_str(selected_core),
        ",\"coreSelections\":", qca_fiss_named_json(core_selections),
        ",\"title\":", json_str(title),
        ",\"legend\":", json_bool(legend),
        ",\"useLabels\":", json_bool(use_labels),
        ",\"command\":", json_str(command),
        ",\"message\":", json_str(message),
        ",\"renderPayload\":", payload_json,
        "}"
    )

    list(ok = TRUE, result = result, result_json = result_json)
}


qca_fiss_export_pdf <- function(params) {
    state <- qca_fiss_dialog_state(params)
    if (!isTRUE(state$ok)) return(state)

    selection <- state$result
    if (!nzchar(selection$selectedSolution)) {
        return(qca_error(selection$message %||% "missing-intermediate-solution"))
    }

    object <- tryCatch(
        get(selection$selectedSolution, envir = .GlobalEnv, inherits = FALSE),
        error = function(error) error
    )
    if (inherits(object, "error")) return(qca_error(conditionMessage(object)))

    models <- object$i.sol[[selection$selectedBranch]]$solution
    if (!is.list(models)) models <- list(models)
    model <- match(selection$selectedModel, paste0("M", seq_along(models)))
    if (is.na(model)) return(qca_error("missing-intermediate-model"))

    chart <- tryCatch(
        qca_fiss_chart(
            object,
            branch = selection$selectedBranch,
            model = model,
            parsimonious = selection$coreSelections
        ),
        error = function(error) error
    )
    if (inherits(chart, "error")) return(qca_error(conditionMessage(chart)))

    labels <- qca_fiss_condition_labels(object, chart, selection$useLabels)
    render <- function(path, width, height) {
        grDevices::pdf(
            path, width = width, height = height,
            onefile = TRUE, paper = "special"
        )
        on.exit(grDevices::dev.off(), add = TRUE)
        graphics::plot(
            chart,
            labels = labels,
            main = selection$title,
            legend = isTRUE(selection$legend)
        )
    }
    probe <- tempfile(fileext = ".pdf")
    target <- tempfile(fileext = ".pdf")
    on.exit(unlink(c(probe, target)), add = TRUE)

    grob <- tryCatch(render(probe, 100, 100), error = function(error) error)
    if (inherits(grob, "error")) return(qca_error(conditionMessage(grob)))

    size <- suppressWarnings(as.numeric(attr(grob, "size")))
    if (length(size) != 2L || any(!is.finite(size)) || any(size <= 0)) {
        return(qca_error("fiss-chart-size-unavailable"))
    }
    size <- ceiling(size * 100) / 100 + 0.02

    output <- tryCatch(
        render(target, size[[1L]], size[[2L]]),
        error = function(error) error
    )
    if (inherits(output, "error")) return(qca_error(conditionMessage(output)))

    bytes <- readBin(target, what = "raw", n = file.info(target)$size)
    hex <- paste(sprintf("%02x", as.integer(bytes)), collapse = "")
    result <- list(
        dataHex = hex,
        width = size[[1L]],
        height = size[[2L]]
    )
    result_json <- paste0(
        "{\"dataHex\":", json_str(hex),
        ",\"width\":", json_num(size[[1L]]),
        ",\"height\":", json_num(size[[2L]]),
        "}"
    )

    list(ok = TRUE, result = result, result_json = result_json)
}


runtime_dispatch_product_method <- function(method, params) {
    switch(method,
        "workspace.truth_tables" = qca_truth_tables(),
        "workspace.dataset_calibrate_thresholds" = qca_calibration_thresholds(params),
        "workspace.dataset_calibrate_preview" = qca_calibration_preview(params),
        "workspace.dataset_xyplot_preview" = qca_xyplot_preview(params),
        "workspace.fiss_dialog_state" = qca_fiss_dialog_state(params),
        "workspace.fiss_export_pdf" = qca_fiss_export_pdf(params),
        NULL
    )
}
