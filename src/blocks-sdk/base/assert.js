// @flow

export function assert(test?: boolean, message?:string, ...optionalParams: any[]) {
  //console.assert(test, message, optionalParams);
  if (test == null) {
    console.trace(message);
    debugger;
  }
}