#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ChatSdkImageCompressor, NSObject)

RCT_EXTERN_METHOD(compress:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end