plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.uniscope.uniscope_mobile"
    // agora_rtc_engine's transitive androidx deps require compileSdk 36 —
    // flutter.compileSdkVersion (31) is too old for them.
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.uniscope.uniscope_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

// KNOWN UPSTREAM ISSUE (agora_rtc_engine 6.5.4, reproduced on 6.6.3 too):
// io.agora.rtc:iris-rtc and io.agora.rtc:agora-special-full both declare
// manifest package "io.agora.rtc". AGP 8.3+ hard-fails the build on that
// duplicate namespace. The two .so files are mutually dependent (iris-rtc's
// libAgoraRtcWrapper.so dlopens agora-special-full's libagora-rtc-sdk.so at
// runtime), so simply excluding iris-rtc built the app but crashed "Join
// Call" with UnsatisfiedLinkError the instant it initialized the Agora
// engine (the JNI wrapper was gone).
//
// Real fix: both AARs are pure native-lib containers (empty classes.jar, no
// manifest components in either) — the "package" attribute is inert at
// runtime, it only feeds AGP's namespace bookkeeping. So we exclude the
// upstream iris-rtc module (unpatched, still collides) and vendor a copy
// with its manifest package rewritten to "io.agora.rtc.iris" instead — see
// app/libs/README.md for how it was produced and how to regenerate it.
// Both native libraries now load correctly.
configurations.all {
    exclude(group = "io.agora.rtc", module = "iris-rtc")
}

dependencies {
    implementation(files("libs/iris-rtc-patched.aar"))
}
