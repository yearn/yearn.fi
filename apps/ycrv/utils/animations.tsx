export const CardVariantsInner = {
	rest: (isFocused: boolean): unknown => ({
		width: isFocused ? 592 : 560,
		height: isFocused ? 733 : 701,
		padding: isFocused ? '64px' : '48px',
		boxShadow: isFocused ? '0px 4px 28px 0px hsla(0, 0%, 0%, 0.25)' : '0px 0px 0px 0px hsla(0, 0%, 0%, 0)',
		transition: {
			duration: 0.6,
			ease: [0.7, -0.4, 0.4, 1.4]
		}
	}),
	hover: {
		width: 592,
		height: 733,
		padding: '64px',
		boxShadow: '0px 4px 28px 0px hsla(0, 0%, 0%, 0.25)',
		transition: {
			duration: 0.6,
			ease: [0.7, -0.4, 0.4, 1.4]
		}
	}
};

export const CardVariants = {
	rest: {
		width: 592,
		transition: {
			duration: 0.6,
			ease: [0.7, -0.4, 0.4, 1.4]
		}
	},
	hover: {
		width: 592,
		transition: {
			duration: 0.6,
			ease: [0.7, -0.4, 0.4, 1.4]
		}
	}
};
