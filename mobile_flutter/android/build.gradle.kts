allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// agora_rtc_engine's build.gradle reads rootProject.ext.compileSdkVersion
// (falling back to 31, which is too old for several of its own transitive
// androidx deps — fragment, window, activity all require 34+). Must be set
// before that subproject evaluates, hence at the very top here.
rootProject.extra["compileSdkVersion"] = 36

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// sentry_flutter 8.14.2's own android/build.gradle hardcodes
// `kotlinOptions { languageVersion = "1.6" }` — this project's Kotlin
// Gradle Plugin (2.3.20, see settings.gradle.kts) has dropped support for
// emitting that language version at all ("Language version 1.6 is no
// longer supported; use version 2.0 or greater instead"), which fails
// `:sentry_flutter:compileReleaseKotlin` outright. A newer sentry_flutter
// (9.x) fixes this upstream, but isn't resolvable against this project's
// current dependency graph (see pubspec.yaml's own comment). Same fix
// shape as the vendored/patched Agora AAR (android/app/libs/README.md) —
// override the one broken setting from the root build rather than editing
// pub-cache (machine-local, wouldn't survive a fresh `flutter pub get` on
// another machine/CI anyway). Scoped to just this module so no other
// subproject's Kotlin compile settings are touched.
subprojects {
    if (project.name == "sentry_flutter") {
        val fixSentryFlutterModule: () -> Unit = {
            tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
                compilerOptions {
                    languageVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_0)
                }
            }
            // Same class of problem, one AAR-metadata check further: this
            // module's own build.gradle also hardcodes
            // `compileSdkVersion 34`, but package_info_plus (its own
            // transitive dependency, pulled in via sentry_flutter's loose
            // `package_info_plus: '>=1.0.0'` constraint) resolved to a
            // version requiring compileSdk 36+ — the exact SDK level the
            // rest of this app already builds against (see
            // rootProject.extra["compileSdkVersion"] = 36 above).
            extensions.findByType(com.android.build.gradle.LibraryExtension::class.java)?.compileSdk = 36
        }
        // The earlier `evaluationDependsOn(":app")` block above can force
        // this project to evaluate before this block's own afterEvaluate
        // registers, depending on Gradle's configuration order — guard
        // both cases rather than assume one.
        if (project.state.executed) fixSentryFlutterModule() else afterEvaluate { fixSentryFlutterModule() }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
