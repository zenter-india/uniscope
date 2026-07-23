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

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
