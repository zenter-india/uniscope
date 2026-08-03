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
  }
}
