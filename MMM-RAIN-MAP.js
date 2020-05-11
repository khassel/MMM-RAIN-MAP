/* Magic Mirror
 * Module: MMM-RAIN-MAP
 */

Module.register("MMM-RAIN-MAP", {
	defaults: {
		height: "420px",
		width: "420px",
		key: "",
		lat: 50,
		lng: 8.27,
		disableDefaultUI: true,
		backgroundColor: "#ccc",
		zoom: 8,
		mapTypeId: "terrain",
		updateIntervalInSeconds: 60,
		animationSpeed: 600,
		opacity: 0.6,
		onlyOnRain: false,
		displayTime: true,
		markers: [],
		zoomOutEach: 2,
		zoomOutLevel: 3,
	},
	map: "",
	timestamps: [],
	radarLayers: [],
	round: 1,
	animationPosition: 0,
	animationTimer: false,
	start: function () {
		self = this;
		this.scheduleUpdate(this.updateInterval);
	},

	getStyles: function () {
		return ["MMM-RAIN-MAP.css"];
	},

	getTranslations: function () {
		return {
			en: "translations/en.json",
			de: "translations/de.json",
		};
	},

	getDom: function () {
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src =
			"https://maps.googleapis.com/maps/api/js?key=" + this.config.key;
		script.setAttribute("defer", "");
		script.setAttribute("async", "");
		document.body.appendChild(script);

		var self = this;

		script.onload = function () {
			self.map = new google.maps.Map(document.getElementById("rain-map-map"), {
				zoom: self.config.zoom,
				mapTypeId: self.config.mapTypeId,
				center: {
					lat: self.config.lat,
					lng: self.config.lng,
				},
				styles: self.styledMapType,
				disableDefaultUI: self.config.disableDefaultUI,
				backgroundColor: self.config.backgroundColor,
			});

			self.config.markers.forEach((marker) => {
				new google.maps.Marker({
					position: {
						lat: marker.lat,
						lng: marker.lng,
					},
					map: self.map,
				});
			});

			self.updateData();
		};

		let app = document.createElement("div");
		let markup = `<div id="rain-map-map" style="height: ${this.config.height}; width: ${this.config.width}"></div>`;
		if (this.config.displayTime) {
			markup += `<div id="rain-map-time"></div>`;
		}

		app.style.height = this.config.height;
		app.style.width = this.config.width;
		app.style.position = "relative";
		app.setAttribute("id", "rain-map-wrapper");
		app.innerHTML = markup;
		return app;
	},

	updateData: function () {
		if (self.config.onlyOnRain) {
			let weaterIcons = document.querySelectorAll(
				"div.currentweather span.wi.weathericon"
			);
			document.getElementById("rain-map-wrapper").style.visibility = "hidden";
			if (weaterIcons && weaterIcons.length === 1) {
				const icon = weaterIcons[0];
				let hasRainIcon = false;
				const iconsToShow = [
					"wi-rain",
					"wi-thunderstorm",
					"wi-snow",
					"wi-night-rain",
					"wi-night-thunderstorm",
					"wi-night-snow",
				];
				iconsToShow.forEach((iconName) => {
					hasRainIcon = hasRainIcon || icon.classList.contains(iconName);
				});
				if (hasRainIcon) {
					this.sendRequest();
					document.getElementById("rain-map-wrapper").style.visibility =
						"visible";
				}
			}
		} else {
			this.sendRequest();
		}
	},

	sendRequest: function () {
		const self = this;
		var apiRequest = new XMLHttpRequest();
		apiRequest.open("GET", "https://api.rainviewer.com/public/maps.json", true);
		apiRequest.onload = function (e) {
			// save available timestamps and show the latest frame: "-1" means "timestamp.lenght - 1"
			self.timestamps = JSON.parse(apiRequest.response);
			self.showFrame(-1);
			self.stop();
			self.play(self);
		};
		apiRequest.send();
	},

	scheduleUpdate: function () {
		const self = this;
		setInterval(function () {
			self.updateData();
		}, this.config.updateIntervalInSeconds * 1000);
	},

	showFrame: function (nextPosition) {
		var preloadingDirection =
			nextPosition - this.animationPosition > 0 ? 1 : -1;

		this.changeRadarPosition(nextPosition);

		this.changeRadarPosition(nextPosition + preloadingDirection, true);
	},

	changeRadarPosition: function (position, preloadOnly) {
		while (position >= this.timestamps.length) {
			position -= this.timestamps.length;
		}
		while (position < 0) {
			position += this.timestamps.length;
		}

		var currentTimestamp = this.timestamps[this.animationPosition];
		var nextTimestamp = this.timestamps[position];

		this.addLayer(nextTimestamp);

		if (preloadOnly) {
			return;
		}

		this.animationPosition = position;

		if (this.radarLayers[currentTimestamp]) {
			this.radarLayers[currentTimestamp].setOpacity(0);
		}
		this.radarLayers[nextTimestamp].setOpacity(this.config.opacity);

		if (this.config.displayTime) {
			const time = new Date(nextTimestamp * 1000);
			document.getElementById(
				"rain-map-time"
			).innerHTML = `${time.getHours()}:${
				time.getMinutes() < 10 ? "0" + time.getMinutes() : time.getMinutes()
			} ${this.translate("time")}`;
		}
	},

	addLayer: function (ts) {
		if (!this.radarLayers[ts]) {
			this.radarLayers[ts] = new google.maps.ImageMapType({
				getTileUrl: function (coord, zoom) {
					return [
						"https://tilecache.rainviewer.com/v2/radar/" + ts + "/256/",
						zoom,
						"/",
						coord.x,
						"/",
						coord.y,
						"/2/1_1.png",
					].join("");
				},
				tileSize: new google.maps.Size(256, 256),
				opacity: 0.0001,
			});
			this.map.overlayMapTypes.push(this.radarLayers[ts]);
		}
	},

	play: function (self) {
		self.showFrame(this.animationPosition + 1);
		if (self.config.zoomOutEach > 0) {
			if (self.config.zoomOutEach === self.round) {
				if (this.animationPosition + 1 === this.timestamps.length) {
					if (self.map.getZoom() === self.config.zoom) {
						self.map.setZoom(self.config.zoom - self.config.zoomOutLevel);
					} else {
						self.map.setZoom(self.config.zoom);
					}
				}
				self.round = 1;
			} else {
				self.round++;
			}
		}

		// Main animation driver. Run this function every 500 ms
		this.animationTimer = setTimeout(function () {
			self.play(self);
		}, self.config.animationSpeed);
	},

	stop: function () {
		if (this.animationTimer) {
			clearTimeout(this.animationTimer);
			this.animationTimer = false;
			return true;
		}
		return false;
	},
});
