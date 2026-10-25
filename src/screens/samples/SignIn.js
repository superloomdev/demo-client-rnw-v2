// Info: Sample screen - sign in. A form composed only of built
// components: fields with inline validation, a remember-me selection, the
// action pair in a ButtonSet, a help tooltip on an IconButton, and a
// submit that shows InlineLoading before a ToastNotification through the
// scene's own OverlayHost.
import { useLib } from '../../app-core/contexts/lib-context.js';
import Scene from '../Scene.js';


export default function SignIn () {

  // Init the container, the theme controller and the form state
  const Lib = useLib();
  const React = Lib.React;
  const ctx = Lib.ThemeContext.useThemeController();
  const R = ctx.Registry;
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [phase, setPhase] = React.useState('idle'); // idle | loading | done

  // The email field reads invalid only after its first blur
  const emailInvalid = touched && email.indexOf('@') === -1;

  // Submit: a fixed inline-loading beat, then the toast
  const submit = function () {
    setTouched(true);
    if (email.indexOf('@') === -1) {
      return;
    }
    setPhase('loading');
    setTimeout(function () {
      setPhase('done');
    }, 1200);
  };

  // Render the form inside the route's own scene
  return React.createElement(Scene, { testID: 'sample-sign-in' },
    React.createElement(Lib.ReactNative.ScrollView, { contentContainerStyle: { padding: 24, gap: 16 } },
      React.createElement(R.Heading, { children: 'Sign in' }),
      React.createElement(R.Section, { level: 2 },
        React.createElement(R.Form, { accessibilityLabel: 'Account' },
          React.createElement(R.FormGroup, { legendText: 'Account' },
            React.createElement(R.TextInput, {
              label: 'Email', placeholder: 'you@example.com', value: email,
              invalid: emailInvalid, invalidText: 'Enter an email with @',
              onChangeText: function (value) {
                setEmail(value);
              },
              onBlur: function () {
                setTouched(true);
              }
            }),
            React.createElement(R.VStack, null,
              React.createElement(R.HStack, { gap: 2 },
                React.createElement(Lib.ReactNative.View, { style: { flex: 1 } },
                  React.createElement(R.FormLabel, { children: 'Password' })),
                React.createElement(R.Tooltip, { label: 'At least eight characters' },
                  React.createElement(R.IconButton, { icon: 'info', label: 'Password help', kind: 'ghost' }))),
              React.createElement(R.PasswordInput, {
                placeholder: 'Password', value: password, accessibilityLabel: 'Password',
                onChangeText: function (value) {
                  setPassword(value);
                }
              })),
            React.createElement(R.Checkbox, {
              label: 'Remember me', checked: remember,
              onChange: function (next) {
                setRemember(next === true || next === 'checked');
              }
            }))),
        React.createElement(R.ButtonSet, {
          stacked: ctx.resolvedForm === 'compact',
          items: [
            { children: 'Create account', kind: 'secondary' },
            { children: 'Sign in', kind: 'primary', onPress: submit }
          ]
        }),
        React.createElement(R.Link, { children: 'Forgot password?', href: '#' }),
        phase === 'loading' ? React.createElement(R.InlineLoading, { description: 'Signing in', status: 'active' }) : null,
        phase === 'done' ? React.createElement(R.ToastNotification, { kind: 'success', title: 'Signed in as ' + email, testID: 'sign-in-toast' }) : null)));

}
