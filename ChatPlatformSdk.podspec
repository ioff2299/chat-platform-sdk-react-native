require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ChatPlatformSdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/ioff2299/chat-platform-sdk-react-native"
  s.license      = "UNLICENSED"
  s.author       = "Chat Platform"
  s.platforms    = { :ios => "13.4" }
  s.source       = { :git => "https://github.com/ioff2299/chat-platform-sdk-react-native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.0"
  s.requires_arc = true

  s.dependency "React-Core"
end
