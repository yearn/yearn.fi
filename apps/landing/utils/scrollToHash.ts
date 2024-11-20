export const scrollToHash = (id: string): void => {
	const element = document.getElementById(id);
	element?.scrollIntoView({behavior: 'smooth', block: 'start', inline: 'nearest'});
};
