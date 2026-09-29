// Info: Static configuration defaults for the demo client. Grouped
// sub-configs per concern; the loader hands each helper only its slice.
export default {

  // ========================= APP IDENTITY ========================= //

  APP_NAME: 'Nimbus',
  ENVIRONMENT: 'development',


  // ========================= THEMING ========================= //

  // The profile a screen gets when it names none, and the breakpoint the
  // component system is built for until the host reports its viewport
  theme: {
    DEFAULT_PROFILE: 'default',
    DEFAULT_BREAKPOINT: 'md'
  },


  // ========================= LOCALIZATION ========================= //

  locale: {
    DEFAULT_LANGUAGE: 'en',
    IS_RTL: false
  },


  // ========================= DEBUG ========================= //

  // Keys match @superloomdev/js-helper-debug config
  debug: {
    LOG_LEVEL: 'warn',
    LOG_FORMAT: 'text',
    INCLUDE_STACK_TRACE: false,
    INCLUDE_MEMORY_USAGE: false,
    APP_NAME: 'Nimbus',
    ENVIRONMENT: 'development'
  }

};
