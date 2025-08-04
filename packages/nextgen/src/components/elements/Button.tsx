import {forwardRef, useMemo} from 'react';
import {PiSpinnerBold} from 'react-icons/pi';
import {type ButtonProps, buttonClassName} from './classNames';

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({className, theme, h, children, ...props}, ref) => {
	const busy = useMemo(() => theme === 'busy', [theme]);
	return (
		<button
			data-theme={theme}
			data-tooltip-id="bearn-sucks"
			ref={ref}
			{...props}
			className={buttonClassName({className, theme, h})}>
			{busy && (
				<div className="relative">
					<div className="invisible">{children}</div>
					<div className="absolute inset-0 flex items-center justify-center">
						<PiSpinnerBold className={`h-6 w-6`} />
					</div>
				</div>
			)}
			{!busy && children}
		</button>
	);
});

Button.displayName = 'Button';

export default Button;
