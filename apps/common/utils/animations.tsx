const transition = {duration: 0.3, ease: 'easeInOut'};
const variants = {
	initial: {y: -80, opacity: 0, transition},
	enter: {y: 0, opacity: 1, transition},
	exit: {y: -80, opacity: 0, transition}
};

export const TABS_VARIANTS = {
	initial: {y: 10, opacity: 0},
	enter: {y: 0, opacity: 1},
	exit: {y: -10, opacity: 0}
};

export {variants};
