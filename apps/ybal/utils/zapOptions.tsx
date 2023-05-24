import {BAL, BALWETH, LPYBAL, STYBAL, WETH, YBAL} from '@yBal/constants/tokens';

import type {TDropdownOption} from '@common/types/types';

const ZAP_OPTIONS_FROM: TDropdownOption[] = [BAL, WETH, BALWETH, YBAL, STYBAL, LPYBAL];
const ZAP_OPTIONS_TO: TDropdownOption[] = [YBAL, STYBAL, LPYBAL];

export {ZAP_OPTIONS_FROM, ZAP_OPTIONS_TO};
