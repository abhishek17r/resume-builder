// Vertical-only dragging, so items can't wander sideways out of their list.
export const restrictToParent = ({ transform }) => ({ ...transform, x: 0 })
