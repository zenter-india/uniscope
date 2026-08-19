# Agora RTC — the vendored iris-rtc AAR's JNI wrapper resolves Java classes
# by name at runtime (see the KNOWN UPSTREAM ISSUE comment in build.gradle.kts);
# anything R8 renames or strips here breaks native call connect silently.
-keep class io.agora.** { *; }
-dontwarn io.agora.**

# Razorpay — official keep rules from their Android SDK integration docs.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes Annotation
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/*
-keepclasseswithmembers class * {
    public void onPayment*(...);
}

# Firebase Messaging — the library ships its own consumer rules, this is a
# safety net against reflection-based lookups (e.g. FCM's automatic
# initialization) being stripped.
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Stream Chat's Dart-side JSON models don't need Java keep rules, but its
# underlying OkHttp/networking stack uses reflection for a few pieces.
-dontwarn okhttp3.**
-dontwarn okio.**
