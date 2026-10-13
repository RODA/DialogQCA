# Install the product's declared native dependencies for unattended acceptance.
options(repos = c(
    "https://dusadrian.r-universe.dev",
    "https://cloud.r-project.org"
))
if (!requireNamespace("jsonlite", quietly = TRUE)) {
    install.packages("jsonlite")
}

startup <- jsonlite::fromJSON("startup/startup-tasks.json", simplifyVector = FALSE)
settings <- jsonlite::fromJSON("settings/settings.json", simplifyVector = FALSE)
packages <- unique(c(
    unlist(lapply(startup, function(task) task$rPackages), use.names = FALSE),
    vapply(settings$rPackageRequirements, function(requirement) {
        requirement$name
    }, character(1))
))
install.packages(packages)
missing <- packages[!vapply(packages, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) {
    stop("Native acceptance dependencies are missing: ", paste(missing, collapse = ", "))
}
