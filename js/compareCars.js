// Compare Cars functionality
// Uses CarAPI (https://carapi.app/api) for MSRP pricing data

(function() {
	const CARAPI_BASE = 'https://carapi.app/api';
	const CARAPI_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJjYXJhcGkuYXBwIiwic3ViIjoiNTIwZTY0ZWMtYzY2Ni00OTE5LWI0NDYtODFlNDlmZjg0ZmQzIiwiYXVkIjoiNTIwZTY0ZWMtYzY2Ni00OTE5LWI0NDYtODFlNDlmZjg0ZmQzIiwiZXhwIjoxNzY2Mjc5ODAzLCJpYXQiOjE3NjU2NzUwMDMsImp0aSI6ImNlZWI4YjhmLTZhZmItNGQ0OC04YzRhLWUwNTM3ZjVmNjg3MCIsInVzZXIiOnsic3Vic2NyaXB0aW9ucyI6W10sInJhdGVfbGltaXRfdHlwZSI6ImhhcmQiLCJhZGRvbnMiOnsiYW50aXF1ZV92ZWhpY2xlcyI6ZmFsc2UsImRhdGFfZmVlZCI6ZmFsc2V9fX0.YaDg-T7xeyZlGpZC4n-HXZgZjg_-qze8Mv-1jmwvakE';
	const FAVORITES_KEY = 'favoriteVehicles';
	const priceCache = new Map();
	
	const CORS_PROXY = 'https://corsproxy.io/?';

	// Get favorites from localStorage
	function getFavorites() {
		try {
			return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
		} catch (e) {
			return [];
		}
	}

	// Save favorites to localStorage
	function saveFavorites(favorites) {
		localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
	}

	// Remove a favorite by ID
	function removeFavorite(vehicleId) {
		const favorites = getFavorites();
		const filtered = favorites.filter(fav => fav.id !== vehicleId);
		saveFavorites(filtered);
		return filtered;
	}

	// Calculate similarity between two strings (simple word overlap)
	function calculateSimilarity(str1, str2) {
		if (!str1 || !str2) return 0;
		
		// Normalize strings: lowercase, remove special chars, split into words
		const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0);
		
		const words1 = normalize(str1);
		const words2 = normalize(str2);
		
		if (words1.length === 0 || words2.length === 0) return 0;
		
		// Count matching words
		let matches = 0;
		for (const word of words1) {
			if (words2.includes(word)) matches++;
		}
		
		// Return percentage of words that match
		return matches / Math.max(words1.length, words2.length);
	}

	// Find the best matching trim from CarAPI results
	function findBestMatch(trims, vehicleTrim) {
		if (!trims || trims.length === 0) return null;
		if (trims.length === 1) return trims[0];
		
		let bestMatch = trims[0];
		let bestScore = 0;
		
		for (const trim of trims) {
			// Compare against description (e.g., "Sport Premium 4dr Sedan (2.0L 4cyl Turbo 7AM)")
			// and trim name (e.g., "Sport Premium")
			const descScore = calculateSimilarity(vehicleTrim, trim.description || '');
			const trimScore = calculateSimilarity(vehicleTrim, trim.trim || '');
			const submodelScore = calculateSimilarity(vehicleTrim, trim.submodel || '');
			
			// Use the best of the three comparisons
			const score = Math.max(descScore, trimScore, submodelScore);
			
			if (score > bestScore) {
				bestScore = score;
				bestMatch = trim;
			}
		}
		
		return bestMatch;
	}

	// Fetch price from CarAPI
	// CarAPI docs: https://carapi.app/api
	// Demo dataset: years 2015-2020, Premium subscription for 1900-today
	async function fetchCarPrice(year, make, model, trim) {
		const cacheKey = `${year}-${make}-${model}-${trim}`.toLowerCase();
		
		if (priceCache.has(cacheKey)) {
			return priceCache.get(cacheKey);
		}

		try {
			// Use /trims/v2 endpoint with year, make, model params
			const apiUrl = `${CARAPI_BASE}/trims/v2?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
			// Route through CORS proxy for local development
			const searchUrl = CORS_PROXY + encodeURIComponent(apiUrl);
			
			const response = await fetch(searchUrl, {
				headers: {
					'Accept': 'application/json',
					'Authorization': `Bearer ${CARAPI_TOKEN}`
				}
			});

			if (!response.ok) {
				throw new Error(`CarAPI returned ${response.status}`);
			}

			const result = await response.json();
			
			// Response structure: { collection: { count, ... }, data: [ { msrp, ... }, ... ] }
			if (result && result.data && result.data.length > 0) {
				// Find the best matching trim based on trim name similarity
				const bestMatch = findBestMatch(result.data, trim);
				const msrp = bestMatch.msrp || null;
				priceCache.set(cacheKey, msrp);
				return msrp;
			}

			priceCache.set(cacheKey, null);
			return null;
		} catch (error) {
			console.warn('CarAPI price lookup failed:', error.message);
			priceCache.set(cacheKey, null);
			return null;
		}
	}

	// Format price for display
	function formatPrice(price) {
		if (price === null || price === undefined) {
			return 'N/A';
		}
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(price);
	}

	// Format spec value
	function formatSpec(value, unit = '') {
		if (value === null || value === undefined || value === 'N/A') {
			return 'N/A';
		}
		return `${value}${unit}`;
	}

	// Build comparison table
	function buildComparisonTable(favorites) {
		if (favorites.length === 0) {
			return `
				<div class="alert alert-info">
					<h5 class="alert-heading">No cars to compare</h5>
					<p class="mb-0">Visit the <a href="inventory.html" class="alert-link">Inventory</a> page and click the star icon on vehicles you'd like to compare.</p>
				</div>
			`;
		}

		// Build header row
		let headerCells = '<th scope="col" class="bg-light" style="min-width: 140px;">Specification</th>';
		favorites.forEach((v, idx) => {
			headerCells += `
				<th scope="col" style="min-width: 180px;">
					<div class="d-flex justify-content-between align-items-start">
						<span>${v.year} ${v.make} ${v.model} ${v.trim}</span>
						<button class="btn btn-sm btn-outline-danger ms-2 remove-btn" data-id="${v.id}" title="Remove">
							<i class="bi bi-x"></i>
						</button>
					</div>
				</th>
			`;
		});

		// Spec rows
		const specs = [
			{ label: 'Est. MSRP', key: 'price', format: (v) => `<span class="price-cell" data-year="${v.year}" data-make="${v.make}" data-model="${v.model}" data-trim="${v.trim}"><span class="spinner-border spinner-border-sm" role="status"></span></span>` },
			{ label: 'Power', key: 'power', format: (v) => formatSpec(v.power, ' hp') },
			{ label: 'Torque', key: 'torque', format: (v) => formatSpec(v.torque, ' Nm') },
			{ label: 'Transmission', key: 'transmission', format: (v) => formatSpec(v.transmission) },
			{ label: 'City MPG', key: 'cityMPG', format: (v) => formatSpec(v.cityMPG, ' mpg') },
			{ label: 'Highway MPG', key: 'hwyMPG', format: (v) => formatSpec(v.hwyMPG, ' mpg') },
			{ label: 'Fuel Type', key: 'fuelType', format: (v) => formatSpec(v.fuelType) },
			{ label: 'Weight', key: 'weight', format: (v) => formatSpec(v.weight, ' lbs') },
			{ label: 'Body Style', key: 'body', format: (v) => formatSpec(v.body) },
			{ label: 'Drive', key: 'drive', format: (v) => formatSpec(v.drive) }
		];

		let rows = '';
		specs.forEach(spec => {
			let cells = `<th scope="row" class="bg-light">${spec.label}</th>`;
			favorites.forEach(v => {
				cells += `<td>${spec.format(v)}</td>`;
			});
			rows += `<tr>${cells}</tr>`;
		});

		return `
			<div class="table-responsive">
				<table class="table table-bordered table-hover align-middle">
					<thead class="table-dark">
						<tr>${headerCells}</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`;
	}

	// Fetch and update all prices
	async function loadPrices() {
		const priceCells = document.querySelectorAll('.price-cell');
		
		for (const cell of priceCells) {
			const year = cell.dataset.year;
			const make = cell.dataset.make;
			const model = cell.dataset.model;
			const trim = cell.dataset.trim;
			
			const price = await fetchCarPrice(year, make, model, trim);
			cell.innerHTML = formatPrice(price);
			
			if (price !== null) {
				cell.classList.add('text-success', 'fw-bold');
			} else {
				cell.classList.add('text-muted');
			}
		}
	}

	// Initialize compare page
	function initComparePage() {
		const container = document.getElementById('compareContainer');
		if (!container) return;

		function render() {
			const favorites = getFavorites();
			container.innerHTML = buildComparisonTable(favorites);

			// Add remove button handlers
			container.querySelectorAll('.remove-btn').forEach(btn => {
				btn.addEventListener('click', function() {
					const vehicleId = this.dataset.id;
					removeFavorite(vehicleId);
					render();
				});
			});

			// Load prices asynchronously
			if (favorites.length > 0) {
				loadPrices();
			}
		}

		render();
	}

	// Initialize when DOM is ready
	document.addEventListener('DOMContentLoaded', () => {
		if (document.getElementById('compareContainer')) {
			initComparePage();
		}
	});
})();

