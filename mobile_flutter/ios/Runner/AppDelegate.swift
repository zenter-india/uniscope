import AVFoundation
import Flutter
import PushKit
import UIKit
import flutter_callkit_incoming

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, PKPushRegistryDelegate {
  // Set once PushKit hands us a real device token; read by the `uniscope/voip`
  // channel below (Dart pulls it once at startup rather than this pushing it
  // proactively, since the Flutter engine/channel may not exist yet the
  // moment the token first arrives).
  private var voipToken: String?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Plugin registration moved HERE (the classic self-registrar pattern —
    // `self` is a `FlutterPluginRegistry` via the `FlutterAppDelegate`
    // superclass) instead of `didInitializeImplicitFlutterEngine` below,
    // specifically for PushKit: `didFinishLaunchingWithOptions` is the one
    // launch callback iOS guarantees on EVERY launch reason, including a
    // real VoIP push waking this app from fully terminated with no UI ever
    // appearing — `didInitializeImplicitFlutterEngine` only fires once a
    // scene actually connects (it's driven by the storyboard's
    // FlutterViewController being created), which a pure background PushKit
    // wake may never do. Registering here creates Flutter's own "launch
    // engine" early (see Flutter's `FlutterLaunchEngine`/`takeLaunchEngine`
    // — built by the Flutter team specifically as a UIScene-migration
    // bridge for exactly this "need plugins before any scene exists" case);
    // when a scene does connect later, `FlutterViewController` adopts this
    // SAME engine rather than creating a second one, so this is a one-time
    // registration, not a duplicate of the call below.
    GeneratedPluginRegistrant.register(with: self)

    // PushKit VoIP registration — this is what makes real call ringing
    // (a full-screen native incoming-call UI, via CallKit, that works even
    // with the app fully killed) possible on iOS. A regular push cannot
    // trigger CallKit at all; only a genuine VoIP push can. See
    // `pushRegistry(_:didReceiveIncomingPushWith:...)` below for the
    // receiving side, and `ApnsVoipService` (backend) for what sends it.
    let voipRegistry = PKPushRegistry(queue: .main)
    voipRegistry.delegate = self
    voipRegistry.desiredPushTypes = [.voIP]

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - PushKit

  func pushRegistry(
    _ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType
  ) {
    guard type == .voIP else { return }
    voipToken = credentials.token.map { String(format: "%02x", $0) }.joined()
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    guard type == .voIP else { return }
    voipToken = nil
  }

  // Called by iOS the moment a real VoIP push arrives — including with the
  // app fully terminated. Apple requires every VoIP push to result in a
  // reported call (via CallKit) or iOS will eventually stop delivering them
  // to this app at all, so this must synchronously report the call rather
  // than routing through Dart (which may not be running yet).
  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }
    let sessionId = payload.dictionaryPayload["sessionId"] as? String ?? UUID().uuidString
    // No caller name is in the push payload (Apple recommends a minimal VoIP
    // payload) — matches the Android instant-call ring's own generic copy
    // (see mobile's `_ringForInstantCall`), not a gap specific to this path.
    let data = flutter_callkit_incoming.Data(
      id: sessionId,
      nameCaller: "Incoming call request",
      handle: "A student wants to connect now",
      type: 0  // audio
    )
    SwiftFlutterCallkitIncomingPlugin.sharedInstance?.showCallkitIncoming(data, fromPushKit: true) {
      completion()
    }
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    // NOTE: plugin registration itself now happens in didFinishLaunchingWithOptions
    // above (see the comment there for why) — calling GeneratedPluginRegistrant.register
    // again here would double-register every plugin on the same engine.
    // engineBridge.pluginRegistry is still needed below, purely as a
    // FlutterBinaryMessenger for this app's own hand-rolled channels.

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

    // Lets push_service.dart pull the current PushKit VoIP token once at
    // startup (uploaded to the backend as platform 'ios-voip', separate
    // from the regular FCM token) — see the `voipToken` property above.
    let voipChannel = FlutterMethodChannel(
      name: "uniscope/voip",
      binaryMessenger: engineBridge.pluginRegistry as! FlutterBinaryMessenger
    )
    voipChannel.setMethodCallHandler { [weak self] call, result in
      switch call.method {
      case "getVoipToken":
        result(self?.voipToken)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}
