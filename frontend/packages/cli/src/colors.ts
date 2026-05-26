const NO_COLOR = !process.stdout.isTTY || process.env.NO_COLOR;

export const c = {
  reset:  NO_COLOR ? '' : '\x1b[0m',
  bold:   NO_COLOR ? '' : '\x1b[1m',
  dim:    NO_COLOR ? '' : '\x1b[2m',
  red:    NO_COLOR ? '' : '\x1b[31m',
  green:  NO_COLOR ? '' : '\x1b[32m',
  yellow: NO_COLOR ? '' : '\x1b[33m',
  cyan:   NO_COLOR ? '' : '\x1b[36m',
  pink:   NO_COLOR ? '' : '\x1b[35m',
  white:  NO_COLOR ? '' : '\x1b[37m',
};
