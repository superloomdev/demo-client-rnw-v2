// Info: Which window has input focus on an Android device, read from the
// output of `adb shell dumpsys window`. A system dialog (another app's "isn't
// responding" prompt, a crash prompt) takes focus over the app, and a
// screenshot taken then shows the dialog, not the app.


/********************************************************************
True when the focused window is one of the app's activities. A dialog
about the app (`Application Not Responding: <id>`) is not the app.

@param {String} dumpsys - Output of `adb shell dumpsys window`
@param {String} appId   - Application id

@return {Boolean} - True when the app's activity has focus
*********************************************************************/
export function isAppFocused (dumpsys, appId) {

  const line = dumpsys.split('\n').find(function (entry) {
    return entry.includes('mCurrentFocus=');
  });

  return line !== undefined && line.includes(' ' + appId + '/');

}
