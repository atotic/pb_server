(function() {
	'use strict';

	function module(stdlib, m, l) {
		'use asm';

		var a = 1732584193,
			b = -271733879,
			c = -1732584194,
			d = 271733878;

		var length = 0;
		length = (l|0);

		// Binary Left Rotate
		function S(X, n) {
			X = X|0; n = n|0;
			return ( X << n ) | (X >> (32 - n))|0;
		}

		function endian_swap(x) {
				x = x|0;
				return (
					(x>>>24) |
					((x<<8) & 0x00FF0000) |
					((x>>>8) & 0x0000FF00) |
					(x<<24)
				)|0;
		}

		function ff (a, b, c, d, x, s, t) {
			a = a|0; b = b|0; c = c|0; d = d|0; x = x|0; s = s|0; t = t|0;
			var n = 0;
			n = (a + (b & c | ~b & d) + (x >>> 0) + t)|0;
			return (((n << s) | (n >>> (32 - s))) + b)|0;
		}
		function gg (a, b, c, d, x, s, t) {
			a = a|0; b = b|0; c = c|0; d = d|0; x = x|0; s = s|0; t = t|0;
			var n = 0;
			n = (a + (b & d | c & ~d) + (x >>> 0) + t)|0;
			return (((n << s) | (n >>> (32 - s))) + b)|0;
		}
		function hh (a, b, c, d, x, s, t) {
			a = a|0; b = b|0; c = c|0; d = d|0; x = x|0; s = s|0; t = t|0;
			var n = 0;
			n = (a + (b ^ c ^ d) + (x >>> 0) + t)|0;
			return (((n << s) | (n >>> (32 - s))) + b)|0;
		}
		function ii (a, b, c, d, x, s, t) {
			a = a|0; b = b|0; c = c|0; d = d|0; x = x|0; s = s|0; t = t|0;
			var n = 0;
			n = (a + (c ^ (b | ~d)) + (x >>> 0) + t)|0;
			return (((n << s) | (n >>> (32 - s))) + b)|0;
		}

		function run() {
			var mlength = 0;
			mlength = (length/8|0);
			for (var i = 0; (i|0) < (mlength|0); i=(i+1)|0) {
				m[i] = ((((m[i] << 8) | (m[i] >>> 24)) & 0x00FF00FF |
						((m[i] << 24) | (m[i] >>> 8)) & 0xFF00FF00))|0;
			}

			m[(length >>> 5)|0] |= (0x80 << (length % 32))|0;
			m[((((length + 64) >>> 9) << 4) + 14)|0] = (length|0);

			for (var i = 0; (i|0) < (mlength|0); i = ((i + 16)|0)) {
				var aa = a|0,
					bb = b|0,
					cc = c|0,
					dd = d|0;


				a = (ff(a|0, b|0, c|0, d|0, m[(i+0)|0], 7, -680876936)|0);
				d = (ff(d|0, a|0, b|0, c|0, m[(i+1)|0], 12, -389564586)|0);
				c = (ff(c|0, d|0, a|0, b|0, m[(i+2)|0], 17, 606105819)|0);
				b = (ff(b|0, c|0, d|0, a|0, m[(i+3)|0], 22, -1044525330)|0);
				a = (ff(a|0, b|0, c|0, d|0, m[(i+4)|0], 7, -176418897)|0);
				d = (ff(d|0, a|0, b|0, c|0, m[(i+5)|0], 12, 1200080426)|0);
				c = (ff(c|0, d|0, a|0, b|0, m[(i+6)|0], 17, -1473231341)|0);
				b = (ff(b|0, c|0, d|0, a|0, m[(i+7)|0], 22, -45705983)|0);
				a = (ff(a|0, b|0, c|0, d|0, m[(i+8)|0], 7, 1770035416)|0);
				d = (ff(d|0, a|0, b|0, c|0, m[(i+9)|0], 12, -1958414417)|0);
				c = (ff(c|0, d|0, a|0, b|0, m[(i+10)|0], 17, -42063)|0);
				b = (ff(b|0, c|0, d|0, a|0, m[(i+11)|0], 22, -1990404162)|0);
				a = (ff(a|0, b|0, c|0, d|0, m[(i+12)|0], 7, 1804603682)|0);
				d = (ff(d|0, a|0, b|0, c|0, m[(i+13)|0], 12, -40341101)|0);
				c = (ff(c|0, d|0, a|0, b|0, m[(i+14)|0], 17, -1502002290)|0);
				b = (ff(b|0, c|0, d|0, a|0, m[(i+15)|0], 22, 1236535329)|0);

				a = (gg(a|0, b|0, c|0, d|0, m[(i+1)|0], 5, -165796510)|0);
				d = (gg(d|0, a|0, b|0, c|0, m[(i+6)|0], 9, -1069501632)|0);
				c = (gg(c|0, d|0, a|0, b|0, m[(i+11)|0], 14, 643717713)|0);
				b = (gg(b|0, c|0, d|0, a|0, m[(i+0)|0], 20, -373897302)|0);
				a = (gg(a|0, b|0, c|0, d|0, m[(i+5)|0], 5, -701558691)|0);
				d = (gg(d|0, a|0, b|0, c|0, m[(i+10)|0], 9, 38016083)|0);
				c = (gg(c|0, d|0, a|0, b|0, m[(i+15)|0], 14, -660478335)|0);
				b = (gg(b|0, c|0, d|0, a|0, m[(i+4)|0], 20, -405537848)|0);
				a = (gg(a|0, b|0, c|0, d|0, m[(i+9)|0], 5, 568446438)|0);
				d = (gg(d|0, a|0, b|0, c|0, m[(i+14)|0], 9, -1019803690)|0);
				c = (gg(c|0, d|0, a|0, b|0, m[(i+3)|0], 14, -187363961)|0);
				b = (gg(b|0, c|0, d|0, a|0, m[(i+8)|0], 20, 1163531501)|0);
				a = (gg(a|0, b|0, c|0, d|0, m[(i+13)|0], 5, -1444681467)|0);
				d = (gg(d|0, a|0, b|0, c|0, m[(i+2)|0], 9, -51403784)|0);
				c = (gg(c|0, d|0, a|0, b|0, m[(i+7)|0], 14, 1735328473)|0);
				b = (gg(b|0, c|0, d|0, a|0, m[(i+12)|0], 20, -1926607734)|0);

				a = (hh(a|0, b|0, c|0, d|0, m[(i+5)|0], 4, -378558)|0);
				d = (hh(d|0, a|0, b|0, c|0, m[(i+8)|0], 11, -2022574463)|0);
				c = (hh(c|0, d|0, a|0, b|0, m[(i+11)|0], 16, 1839030562)|0);
				b = (hh(b|0, c|0, d|0, a|0, m[(i+14)|0], 23, -35309556)|0);
				a = (hh(a|0, b|0, c|0, d|0, m[(i+1)|0], 4, -1530992060)|0);
				d = (hh(d|0, a|0, b|0, c|0, m[(i+4)|0], 11, 1272893353)|0);
				c = (hh(c|0, d|0, a|0, b|0, m[(i+7)|0], 16, -155497632)|0);
				b = (hh(b|0, c|0, d|0, a|0, m[(i+10)|0], 23, -1094730640)|0);
				a = (hh(a|0, b|0, c|0, d|0, m[(i+13)|0], 4, 681279174)|0);
				d = (hh(d|0, a|0, b|0, c|0, m[(i+0)|0], 11, -358537222)|0);
				c = (hh(c|0, d|0, a|0, b|0, m[(i+3)|0], 16, -722521979)|0);
				b = (hh(b|0, c|0, d|0, a|0, m[(i+6)|0], 23, 76029189)|0);
				a = (hh(a|0, b|0, c|0, d|0, m[(i+9)|0], 4, -640364487)|0);
				d = (hh(d|0, a|0, b|0, c|0, m[(i+12)|0], 11, -421815835)|0);
				c = (hh(c|0, d|0, a|0, b|0, m[(i+15)|0], 16, 530742520)|0);
				b = (hh(b|0, c|0, d|0, a|0, m[(i+2)|0], 23, -995338651)|0);

				a = (ii(a|0, b|0, c|0, d|0, m[(i+0)|0], 6, -198630844)|0);
				d = (ii(d|0, a|0, b|0, c|0, m[(i+7)|0], 10, 1126891415)|0);
				c = (ii(c|0, d|0, a|0, b|0, m[(i+14)|0], 15, -1416354905)|0);
				b = (ii(b|0, c|0, d|0, a|0, m[(i+5)|0], 21, -57434055)|0);
				a = (ii(a|0, b|0, c|0, d|0, m[(i+12)|0], 6, 1700485571)|0);
				d = (ii(d|0, a|0, b|0, c|0, m[(i+3)|0], 10, -1894986606)|0);
				c = (ii(c|0, d|0, a|0, b|0, m[(i+10)|0], 15, -1051523)|0);
				b = (ii(b|0, c|0, d|0, a|0, m[(i+1)|0], 21, -2054922799)|0);
				a = (ii(a|0, b|0, c|0, d|0, m[(i+8)|0], 6, 1873313359)|0);
				d = (ii(d|0, a|0, b|0, c|0, m[(i+15)|0], 10, -30611744)|0);
				c = (ii(c|0, d|0, a|0, b|0, m[(i+6)|0], 15, -1560198380)|0);
				b = (ii(b|0, c|0, d|0, a|0, m[(i+13)|0], 21, 1309151649)|0);
				a = (ii(a|0, b|0, c|0, d|0, m[(i+4)|0], 6, -145523070)|0);
				d = (ii(d|0, a|0, b|0, c|0, m[(i+11)|0], 10, -1120210379)|0);
				c = (ii(c|0, d|0, a|0, b|0, m[(i+2)|0], 15, 718787259)|0);
				b = (ii(b|0, c|0, d|0, a|0, m[(i+9)|0], 21, -343485551)|0);

				a = ((a+aa)|0 >>>0)|0;
				b = ((b+bb)|0>>>0)|0;
				c = ((c+cc)|0>>>0)|0;
				d = ((d+dd)|0>>>0)|0;
			}

			return (endian_swap(1));
		}

		return {
			run: run,
		};
	}

	function md5(s) {
		var str = stringToBytes(s);
		var m = bytesToWords(str);
		var l = str.length * 8;
		this.mod = module(window, m, l);
	}

	md5.prototype.getMd5 = function() {
		var result = this.mod.run();
		var bytes = wordsToBytes(result);

		return decodeURIComponent(escape(bytesToHex(bytes)));
	}

	function stringToBytes(str) {
		str = unescape(encodeURIComponent(str));
		for (var bytes = [], i = 0; i < str.length; i++)
			bytes.push(str.charCodeAt(i) & 0xFF);
		return bytes;
	}

	function bytesToString(bytes) {
		for (var str = [], i = 0; i < bytes.length; i++)
			str.push(String.fromCharCode(bytes[i]));
		return str.join("");
	}

	function bytesToWords(bytes) {
		for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
			words[b >>> 5] |= (bytes[i] & 0xFF) << (24 - b % 32);
		return words;
	}

	function wordsToBytes(words) {
		for (var bytes = [], b = 0; b < words.length * 32; b += 8)
			bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
		return bytes;
	}

	function bytesToHex(bytes) {
		for (var hex = [], i = 0; i < bytes.length; i++) {
			hex.push((bytes[i] >>> 4).toString(16));
			hex.push((bytes[i] & 0xF).toString(16));
		}
		return hex.join("");
	}

	window.md5 = md5;
})();
