// Minimal JS - ready for you to add animations
// Removed lax.js and rough-notation - you can add your own or use CSS animations

document.addEventListener("DOMContentLoaded", () => {
	// Remove loading state after images load
	const home = document.querySelector(".home");
	if (home) {
		home.classList.add("is-loading");
		window.addEventListener("load", () => {
			home.classList.remove("is-loading");
		});
	}

	// Example: staggered fade-in for gallery images using CSS
	// The CSS handles the transition-delay, JS just removes the loading class
});

// Placeholder for future animations:
// - Scroll-driven animations (CSS animation-timeline or custom JS)
// - Barba.js page transitions
// - Draggable canvas for work showcase
