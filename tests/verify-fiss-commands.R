# Exercise generated commands against QCA's real selection and plotting defaults.
opts <- list()
forge_root <- Sys.getenv("DIALOGFORGE_ROOT", unset = "../DialogForge")
source(file.path(forge_root, "src/runtime/providers/r/r-sources/runtimePrelude.R"))
source("runtime/runtimeControlProfile.R")
library(QCA)

plot_file <- tempfile(fileext = ".pdf")
grDevices::pdf(plot_file, width = 30, height = 20)

text_labels <- function(grob) {
    if (inherits(grob, "text")) return(as.character(grob$label))
    unlist(lapply(grob$children, text_labels), use.names = FALSE)
}

verify_command <- function(name, object, branch, chart, title, legend, labels, model = 1L) {
    command <- qca_fiss_plot_command(
        name, object, branch, model, chart, title, legend, labels
    )
    expression <- parse(text = command)[[1L]]
    generated_chart <- eval(expression[[2L]], envir = .GlobalEnv)
    stopifnot(
        identical(generated_chart$values, chart$values),
        identical(generated_chart$roles, chart$roles),
        identical(generated_chart$fit, chart$fit),
        identical(generated_chart$solution.fit, chart$solution.fit)
    )
    generated <- eval(expression, envir = .GlobalEnv)
    expected <- plot(chart, main = title, labels = labels, legend = legend)
    stopifnot(
        identical(text_labels(generated), text_labels(expected)),
        identical(attr(generated, "size"), attr(expected, "size")),
        all(nchar(strsplit(command, "\n", fixed = TRUE)[[1L]]) <= 75L)
    )
    command
}

tryCatch({
    data(LF)
    ttLF <- truthTable(LF, SURV, incl.cut = 0.8, show.cases = TRUE)
    iLF <- minimize(ttLF, include = "?", details = TRUE,
        dir.exp = c(DEV, URB, LIT, IND, STB))
    chart <- fissChart(iLF)
    verify_title <- function(name, object, use_labels, expected, title = "") {
        state <- qca_fiss_dialog_state(list(
            solutionName = name, useLabels = use_labels, title = title
        ))$result
        stopifnot(
            identical(state$title, expected),
            identical(state$renderPayload$title, expected)
        )
        chart <- fissChart(object)
        command <- verify_command(name, object, "C1P1", chart, expected, FALSE,
            qca_fiss_condition_labels(object, chart, use_labels))
        stopifnot(identical(state$command, command))
    }
    verify_title("iLF", iLF, FALSE, "Configurations for SURV")
    verify_title("iLF", iLF, TRUE, "Configurations for Democracy survival")
    verify_title("iLF", iLF, TRUE, "Configurations for SURV",
        title = "Configurations for SURV")
    verify_title("iLF", iLF, FALSE, "My title", title = "My title")
    # The negative outcome has its own label, rather than a negated positive label.
    ttCollapse <- truthTable(LF, ~SURV, incl.cut = 0.8)
    iCollapse <- minimize(ttCollapse, include = "?", details = TRUE,
        dir.exp = c(DEV, URB, LIT, IND, STB))
    collapse_chart <- fissChart(iCollapse)
    stopifnot(
        identical(qca_fiss_outcome_label(iCollapse, collapse_chart, TRUE), "Democracy collapse"),
        identical(qca_fiss_outcome_label(iCollapse, collapse_chart, FALSE), "~SURV")
    )
    command <- verify_command("iLF", iLF, "C1P1", chart,
        "Configurations for SURV", FALSE, rownames(chart$values))
    stopifnot(identical(command, "plot(\n  fissChart(iLF),\n  legend = FALSE\n)"))
    command <- verify_command("iLF", iLF, "C1P1", chart,
        "Configurations for SURV", TRUE, rownames(chart$values))
    stopifnot(identical(command, "plot(fissChart(iLF))"))

    title <- "Survival: \"European\" cases\nRevised"
    labels <- qca_fiss_condition_labels(iLF, chart, use.labels = TRUE)
    command <- verify_command("iLF", iLF, "C1P1", chart, title, FALSE, labels)
    stopifnot(grepl("  labels = c(\n", command, fixed = TRUE))
    stopifnot(identical(eval(parse(text = command)[[1L]]$main), title))

    ttLabels <- truthTable(LF, SURV, incl.cut = 0.8, use.labels = TRUE)
    iLabels <- minimize(ttLabels, include = "?", details = TRUE,
        dir.exp = c(DEV, URB, LIT, IND, STB))
    chart <- fissChart(iLabels)
    verify_title("iLabels", iLabels, TRUE, "Configurations for Democracy survival")
    verify_title("iLabels", iLabels, FALSE, "Configurations for SURV")
    labels <- qca_fiss_condition_labels(iLabels, chart, use.labels = TRUE)
    command <- verify_command("iLabels", iLabels, "C1P1", chart,
        "Configurations for Democracy survival", FALSE, labels)
    # Older QCA versions do not yet inherit truth-table labels in plot().
    # Such versions still need the explicit override to reproduce the dialog.
    if (is.null(chart$condition.labels)) {
        stopifnot(grepl("labels =", command, fixed = TRUE))
    } else {
        stopifnot(!grepl("labels =", command, fixed = TRUE))
    }
    if (is.null(chart$outcome.label)) {
        stopifnot(grepl('main = "Configurations for Democracy survival"', command, fixed = TRUE))
    } else {
        stopifnot(!grepl("main =", command, fixed = TRUE))
    }
    command <- verify_command("iLabels", iLabels, "C1P1", chart,
        "Configurations for Democracy survival", FALSE, rownames(chart$values))
    stopifnot(identical(
        grepl("labels =", command, fixed = TRUE),
        !is.null(chart$condition.labels) && !identical(as.character(chart$condition.labels), rownames(chart$values))
    ))

    data(d.jobsecurity)
    iJobs <- minimize(d.jobsecurity, outcome = "JSR", incl.cut = 0.9,
        include = "?", dir.exp = "1,1,1,1,1,0", details = TRUE)
    chart <- fissChart(iJobs, branch = "C1P2")
    stopifnot(identical(qca_fiss_outcome_label(iJobs, chart, TRUE), "JSR"))
    command <- verify_command("iJobs", iJobs, "C1P2", chart,
        "Configurations for JSR", FALSE, rownames(chart$values))
    stopifnot(
        grepl('    branch = "C1P2"', command, fixed = TRUE),
        !grepl("model =", command, fixed = TRUE)
    )

    chart <- fissChart(iJobs, branch = "C1P1", resolve = "first")
    ambiguous <- which(lengths(chart$candidates) > 1L)[[1L]]
    selected <- chart$parsimonious
    selected[[ambiguous]] <- chart$candidates[[ambiguous]][[2L]]
    chart <- fissChart(iJobs, branch = "C1P1", parsimonious = selected)
    command <- verify_command("iJobs", iJobs, "C1P1", chart,
        "Configurations for JSR", FALSE, rownames(chart$values))
    stopifnot(grepl("    parsimonious = c(", command, fixed = TRUE))
    data(d.represent)
    iRepresent <- minimize(d.represent, outcome = "WNP", include = "?",
        dir.exp = "0,0,0,0,0", details = TRUE)
    chart <- fissChart(iRepresent, branch = "C1P1", model = 1, resolve = "first")
    command <- verify_command("iRepresent", iRepresent, "C1P1", chart,
        "Configurations for WNP", FALSE, rownames(chart$values))
    stopifnot(
        length(iRepresent$i.sol$C1P1$solution) > 1L,
        grepl('    branch = "C1P1"', command, fixed = TRUE),
        grepl("    model = 1", command, fixed = TRUE)
    )
    cat("Fiss commands preserve chart values, roles, fit, labels, title and legend; defaults omitted and nested arguments indented.\n")
}, finally = {
    grDevices::dev.off()
    unlink(plot_file)
})
