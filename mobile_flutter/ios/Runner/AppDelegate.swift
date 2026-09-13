import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    // iOS counterpart to the Android MainActivity's hand-rolled mic-permission
    // channel — same "uniscope/permissions" contract (requestMicrophone,
    // openAppSettings), used directly by call_screen.dart instead of the
    // permission_handler plugin.
    let channel = FlutterMethodChannel(
      name: "uniscope/permissions",
      binaryMessenger: engineBridge.pluginRegistry as! FlutterBinaryMessenger
    )
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "requestMicrophone":
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
          result(true)
        case .denied:
          result(false)
        case .undetermined:
          AVAudioSession.sharedInstance().requestRecordPermission { granted in
            DispatchQueue.main.async { result(granted) }
          }
        @unknown default:
          result(false)
        }
      case "openAppSettings":
        if let url = URL(string: UIApplication.openSettingsURLString) {
          UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }

    // iOS counterpart to the Android MainActivity's "uniscope/call" channel.
    // Real bug (device report: phone held to the ear during a call keeps its
    // display lit, so a cheek/ear touch can accidentally hang up): this
    // channel didn't exist on iOS at all, so call_screen.dart's
    // `_startCallService` — which calls `startCallService`, `keepScreenOn`,
    // then `setProximityScreenOff` as three sequential awaits inside ONE
    // try/catch — threw MissingPluginException on the very first call and
    // never reached the other two, meaning `setProximityScreenOff` (the
    // actual fix for this) silently never ran on iOS at all.
    //
    // `startCallService`/`stopCallService` are no-ops here on purpose: the
    // Android side starts a foreground service so Agora's audio survives
    // backgrounding, but iOS already gets that from Info.plist's
    // `UIBackgroundModes: audio` — there's no iOS equivalent of an Android
    // foreground service to start. Both still have to *succeed* (not throw)
    // so the awaits after them actually run.
    let callChannel = FlutterMethodChannel(
      name: "uniscope/call",
      binaryMessenger: engineBridge.pluginRegistry as! FlutterBinaryMessenger
    )
    callChannel.setMethodCallHandler { call, result in
      switch call.method {
      case "startCallService", "stopCallService":
        result(nil)
      case "keepScreenOn":
        let on = (call.arguments as? Bool) ?? false
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = on }
        result(nil)
      case "setProximityScreenOff":
        // The real fix: once enabled, iOS automatically dims/turns off the
        // display when the proximity sensor is covered (phone to the ear)
        // and back on when it isn't — the same mechanism the built-in
        // Phone app uses, no manual screen-dimming code needed.
        let on = (call.arguments as? Bool) ?? false
        DispatchQueue.main.async { UIDevice.current.isProximityMonitoringEnabled = on }
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}
