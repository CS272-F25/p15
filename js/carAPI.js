// CarQuery API
// Documentation: https://www.carqueryapi.com/documentation/api-usage/

(function() {
	const API_BASE = 'https://www.carqueryapi.com/api/0.3/';
	const cache = new Map(); // in-memory cache for page session
	const FAVORITES_KEY = 'favoriteVehicles';
	
	// car images to randomly choose from(extra goal from meeting)
	const carImages = [
		'img/car1.jpg',
		'img/car2.webp',
		'img/car3.webp',
		'img/car4.avif',
		'img/car5.jpg',
		'img/car6.jpeg',
		'img/car7.jpg',
		'img/car8.avif',
		'img/car9.avif',
		'img/city-sedan-2021.jpg',
		'img/family-suv-2023.jpg',
		'img/speedster-2022.jpg'
	];
	
	function getRandomCarImage() {
		return carImages[Math.floor(Math.random() * carImages.length)];
	}

	// Favorites management
	function getFavorites() {
		try {
			return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
		} catch (e) {
			return [];
		}
	}

	function saveFavorites(favorites) {
		localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
	}

	function generateVehicleId(vehicle) {
		return `${vehicle.year}-${vehicle.make}-${vehicle.model}-${vehicle.trim}`.toLowerCase().replace(/\s+/g, '-');
	}

	function isFavorite(vehicleId) {
		return getFavorites().some(fav => fav.id === vehicleId);
	}

	function toggleFavorite(vehicle) {
		const favorites = getFavorites();
		const existingIndex = favorites.findIndex(fav => fav.id === vehicle.id);
		if (existingIndex > -1) {
			favorites.splice(existingIndex, 1);
		} else {
			favorites.push(vehicle);
		}
		saveFavorites(favorites);
		return existingIndex === -1; // returns true if added, false if removed
	}

	function jsonpRequest(params) {
		return new Promise((resolve, reject) => {
			const callbackName = 'cq_cb_' + Math.random().toString(36).slice(2);
			params.callback = callbackName;
			const qs = new URLSearchParams(params).toString();
			const url = API_BASE + '?' + qs;

			if (cache.has(url)) {
				resolve(cache.get(url));
				return;
			}

			const script = document.createElement('script');
			script.src = url;
			script.async = true;

			window[callbackName] = (data) => {
				cache.set(url, data);
				cleanup();
				resolve(data);
			};

			script.onerror = () => {
				cleanup();
				reject(new Error('CarQuery request failed'));
			};

			function cleanup() {
				delete window[callbackName];
				script.remove();
			}

			document.head.appendChild(script);
		});
	}

	// select element with options
	function fillSelect(selectEl, items, getValue, getLabel, placeholder) {
		selectEl.innerHTML = '';
		if (placeholder) {
			const opt = document.createElement('option');
			opt.value = '';
			opt.textContent = placeholder;
			selectEl.appendChild(opt);
		}
		items.forEach(item => {
			const opt = document.createElement('option');
			opt.value = getValue(item);
			opt.textContent = getLabel(item);
			selectEl.appendChild(opt);
		});
		selectEl.disabled = items.length === 0;
	}

	// Year range helper
	function generateYears(start, end) {
		const years = [];
		for (let y = end; y >= start; y--) years.push(y);
		return years;
	}

	// Inventory page logic
	function initInventoryPage() {
		const yearSel = document.getElementById('invYearSelect');
		const makeSel = document.getElementById('invMakeSelect');
		const modelSel = document.getElementById('invModelSelect');
		const searchBtn = document.getElementById('applyInventoryFilters');
		const resetBtn = document.getElementById('resetInventoryFilters');
		const resultsEl = document.getElementById('inventoryResults');

		if (!yearSel || !makeSel || !modelSel) return; // Not on page

		// Years: 2000-2020
		const years = generateYears(2000, 2020);
		fillSelect(yearSel, years, y => y, y => y, 'Any Year');

		yearSel.addEventListener('change', async () => {
			makeSel.disabled = true;
			modelSel.disabled = true;
			modelSel.innerHTML = '<option value="">Select Make First</option>';
			searchBtn.disabled = true;
			const year = yearSel.value;
			if (!year) {
				makeSel.innerHTML = '<option value="">Select Year First</option>';
				return;
			}
			try {
				const data = await jsonpRequest({ cmd: 'getMakes', sold_in_us: 1, year });
				const makes = (data && data.Makes) || [];
				fillSelect(makeSel, makes, m => m.make_id, m => m.make_display, 'Make');
			} catch (e) {
				makeSel.innerHTML = '<option value="">Error Loading Makes</option>';
			}
		});

		makeSel.addEventListener('change', async () => {
			modelSel.disabled = true;
			searchBtn.disabled = true;
			const make = makeSel.value;
			const year = yearSel.value;
			if (!make) {
				modelSel.innerHTML = '<option value="">Select Make First</option>';
				return;
			}
			try {
				const data = await jsonpRequest({ cmd: 'getModels', make, year });
				const models = (data && data.Models) || [];
				fillSelect(modelSel, models, m => m.model_name, m => m.model_name, 'Model');
			} catch (e) {
				modelSel.innerHTML = '<option value="">Error Loading Models</option>';
			}
		});

		modelSel.addEventListener('change', () => {
			searchBtn.disabled = !modelSel.value;
		});

		searchBtn.addEventListener('click', async () => {
			const year = yearSel.value;
			const make = makeSel.value;
			const model = modelSel.value;
			if (!year || !make || !model) return;
			resultsEl.innerHTML = '<div class="col-12"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
			try {
				const data = await jsonpRequest({ cmd: 'getTrims', year, make, model });
				const trims = (data && data.Trims) || [];
				if (!trims.length) {
					resultsEl.innerHTML = '<div class="col-12"><div class="alert alert-warning">No trims found.</div></div>';
					return;
				}
				const fragment = document.createDocumentFragment();
				trims.slice(0, 12).forEach(t => {
					const vehicle = {
						year: year,
						make: make.toUpperCase(),
						model: t.model_name,
						trim: t.model_trim || 'Standard',
						body: t.model_body || 'N/A',
						engine: t.model_engine_position || 'N/A',
						drive: t.model_drive || 'N/A',
						// Extended specs for comparison
						power: t.model_engine_power_ps || null,
						torque: t.model_engine_torque_nm || null,
						transmission: t.model_transmission_type || 'N/A',
						cityMPG: t.model_lkm_city || null,
						hwyMPG: t.model_lkm_hwy || null,
						fuelType: t.model_engine_fuel || 'N/A',
						weight: t.model_weight_kg || null
					};
					vehicle.id = generateVehicleId(vehicle);
					const isFav = isFavorite(vehicle.id);

					const col = document.createElement('div');
					col.className = 'col-md-4';
					col.innerHTML = `
						<div class="card h-100 shadow-sm">
							<img src="${getRandomCarImage()}" class="card-img-top" alt="${vehicle.year} ${vehicle.make} ${vehicle.model}" style="height: 200px; object-fit: cover;">
							<div class="card-body">
								<div class="d-flex justify-content-between align-items-start">
									<h3 class="h6 card-title mb-0">${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim !== 'Standard' ? vehicle.trim : ''}</h3>
									<button class="btn btn-link p-0 favorite-btn" data-vehicle='${JSON.stringify(vehicle)}' title="Add to favorites">
										<i class="bi ${isFav ? 'bi-star-fill text-warning' : 'bi-star'}" style="font-size: 1.25rem;"></i>
									</button>
								</div>
								<p class="small mb-2 mt-2">Body: ${vehicle.body} | Engine: ${vehicle.engine}</p>
								<p class="small mb-3">Drive: ${vehicle.drive} | Fuel: ${vehicle.fuel}</p>
								<a href="schedule-test-drive.html" class="btn btn-outline-primary btn-sm">Test Drive</a>
							</div>
						</div>`;
					fragment.appendChild(col);
				});
				resultsEl.innerHTML = '';
				resultsEl.appendChild(fragment);

				// Add click handlers for favorite buttons
				resultsEl.querySelectorAll('.favorite-btn').forEach(btn => {
					btn.addEventListener('click', function() {
						const vehicle = JSON.parse(this.dataset.vehicle);
						const added = toggleFavorite(vehicle);
						const icon = this.querySelector('i');
						if (added) {
							icon.classList.remove('bi-star');
							icon.classList.add('bi-star-fill', 'text-warning');
						} else {
							icon.classList.remove('bi-star-fill', 'text-warning');
							icon.classList.add('bi-star');
						}
					});
				});
			} catch (e) {
				resultsEl.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error loading trims.</div></div>';
			}
		});

		resetBtn.addEventListener('click', () => {
			yearSel.selectedIndex = 0;
			makeSel.innerHTML = '<option value="">Select Year First</option>';
			makeSel.disabled = true;
			modelSel.innerHTML = '<option value="">Select Make First</option>';
			modelSel.disabled = true;
			searchBtn.disabled = true;
			resultsEl.innerHTML = '<div class="col-12" id="inventoryPlaceholder"><div class="alert alert-info mb-0">Choose filters and click Search to load sample trims.</div></div>';
		});
	}

	// Test Drive page logic
	function initTestDrivePage() {
		const yearSel = document.getElementById('tdYearSelect');
		const makeSel = document.getElementById('tdMakeSelect');
		const modelSel = document.getElementById('tdModelSelect');
		const trimSel = document.getElementById('tdTrimSelect');
		const form = document.getElementById('testDriveForm');
		const confirmEl = document.getElementById('tdConfirmation');
		const submitBtn = document.getElementById('submitTestDrive');

		if (!form || !yearSel) return; // Not on page

		// Years: 2000-2020
		const years = generateYears(2000, 2020);
		fillSelect(yearSel, years, y => y, y => y, 'Year');

		yearSel.addEventListener('change', async () => {
			makeSel.disabled = true;
			modelSel.disabled = true;
			trimSel.disabled = true;
			trimSel.innerHTML = '<option value="">Trim</option>';
			submitBtn.disabled = true;
			const year = yearSel.value;
			if (!year) {
				makeSel.innerHTML = '<option value="">Make</option>';
				return;
			}
			try {
				const data = await jsonpRequest({ cmd: 'getMakes', sold_in_us: 1, year });
				const makes = (data && data.Makes) || [];
				fillSelect(makeSel, makes, m => m.make_id, m => m.make_display, 'Make');
			} catch (e) {
				makeSel.innerHTML = '<option value="">Error</option>';
			}
		});

		makeSel.addEventListener('change', async () => {
			modelSel.disabled = true;
			trimSel.disabled = true;
			submitBtn.disabled = true;
			const make = makeSel.value;
			const year = yearSel.value;
			if (!make) {
				modelSel.innerHTML = '<option value="">Model</option>';
				return;
			}
			try {
				const data = await jsonpRequest({ cmd: 'getModels', make, year });
				const models = (data && data.Models) || [];
				fillSelect(modelSel, models, m => m.model_name, m => m.model_name, 'Model');
			} catch (e) {
				modelSel.innerHTML = '<option value="">Error</option>';
			}
		});

		modelSel.addEventListener('change', async () => {
			trimSel.disabled = true;
			submitBtn.disabled = true;
			const make = makeSel.value;
			const model = modelSel.value;
			const year = yearSel.value;
			if (!model) {
				trimSel.innerHTML = '<option value="">Trim</option>';
				return;
			}
			try {
				const data = await jsonpRequest({ cmd: 'getTrims', make, model, year });
				const trims = (data && data.Trims) || [];
				fillSelect(trimSel, trims, t => t.model_trim || 'Standard', t => t.model_trim || 'Standard', 'Trim');
			} catch (e) {
				trimSel.innerHTML = '<option value="">Error</option>';
			}
		});

		trimSel.addEventListener('change', () => {
			submitBtn.disabled = !trimSel.value;
		});

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			if (submitBtn.disabled) return;
			const summary = {
				year: yearSel.value,
				make: makeSel.options[makeSel.selectedIndex].text,
				model: modelSel.value,
				trim: trimSel.value || 'Standard',
				date: document.getElementById('tdDate').value,
				time: document.getElementById('tdTime').value,
				name: document.getElementById('tdName').value,
				email: document.getElementById('tdEmail').value,
				notes: document.getElementById('tdNotes').value.trim()
			};
			confirmEl.classList.remove('d-none');
			confirmEl.innerHTML = `Request received for <strong>${summary.year} ${summary.make} ${summary.model} ${summary.trim}</strong> on <strong>${summary.date}</strong> at <strong>${summary.time}</strong>. We will email <em>${summary.email}</em> soon.`;
			form.reset();
			submitBtn.disabled = true;
			trimSel.disabled = true;
			modelSel.disabled = true;
			makeSel.disabled = true;
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		if (document.getElementById('inventoryApp')) initInventoryPage();
		if (document.getElementById('testDriveApp')) initTestDrivePage();
	});
})();

