pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_RE repositories)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Chess"
include(":app")
