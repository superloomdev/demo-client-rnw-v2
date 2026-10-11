// Info: The showcase cell's chrome: the padding and border a cell draws
// around its body, named once so the cell's style, the grid's room and
// the walker's report all read the same numbers. The room a cell body
// gets is the grid width minus the chrome on both sides.

export const CELL_PADDING = 12;
export const CELL_BORDER = 1;
export const CELL_CHROME = 2 * (CELL_PADDING + CELL_BORDER);
