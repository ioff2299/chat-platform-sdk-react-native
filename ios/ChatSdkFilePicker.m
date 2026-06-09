#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ChatSdkFilePicker, NSObject)

RCT_EXTERN_METHOD(pick:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
