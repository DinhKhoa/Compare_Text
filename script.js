// ===== STATE =====
let currentMode = "unified";
let lastDiff = null;

// ===== CHARACTER COUNTS =====
const originalEl = document.getElementById("original");
const modifiedEl = document.getElementById("modified");

originalEl.addEventListener("input", () => {
	document.getElementById("countOriginal").textContent =
		originalEl.value.length.toLocaleString("vi-VN") + " ký tự";
});
modifiedEl.addEventListener("input", () => {
	document.getElementById("countModified").textContent =
		modifiedEl.value.length.toLocaleString("vi-VN") + " ký tự";
});

// ===== COMPARE =====
function runCompare() {
	const orig = originalEl.value;
	const mod = modifiedEl.value;

	if (!orig && !mod) return;

	lastDiff = Diff.diffLines(orig, mod);
	renderDiff();
}

// ===== RENDER =====
function renderDiff() {
	if (!lastDiff) return;

	const container = document.getElementById("diffContainer");
	const body = document.getElementById("diffBody");
	const statsBar = document.getElementById("statsBar");

	// Stats
	let addCount = 0,
		delCount = 0,
		unchangedCount = 0;
	lastDiff.forEach((part) => {
		const lines = part.value.replace(/\n$/, "").split("\n");
		const count = lines.length;
		if (part.added) addCount += count;
		else if (part.removed) delCount += count;
		else unchangedCount += count;
	});

	document.getElementById("statAdd").textContent = "+" + addCount;
	document.getElementById("statDel").textContent = "-" + delCount;
	document.getElementById("statUnchanged").textContent = unchangedCount;
	statsBar.classList.add("visible");

	// Check if identical
	if (addCount === 0 && delCount === 0) {
		body.innerHTML = `
          <div class="no-diff">
            <svg class="icon-check" viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
            <strong>Hai văn bản hoàn toàn giống nhau!</strong>
            <p>Không có sự khác biệt nào được tìm thấy.</p>
          </div>`;
		container.classList.add("visible");
		return;
	}

	if (currentMode === "unified") {
		renderUnified(body);
	} else if (currentMode === "split") {
		renderSplit(body);
	} else {
		renderInline(body);
	}

	container.classList.add("visible");
}

// ===== HELPER: Group diff parts =====
function groupDiffParts(diffData) {
	const groups = [];
	let i = 0;
	while (i < diffData.length) {
		if (
			diffData[i].removed &&
			i + 1 < diffData.length &&
			diffData[i + 1].added
		) {
			groups.push({
				type: "change",
				removed: diffData[i],
				added: diffData[i + 1],
			});
			i += 2;
		} else {
			groups.push({
				type: diffData[i].added
					? "added"
					: diffData[i].removed
						? "removed"
						: "unchanged",
				part: diffData[i],
			});
			i++;
		}
	}
	return groups;
}

// ===== INLINE VIEW =====
function renderInline(body) {
	const orig = originalEl.value;
	const mod = modifiedEl.value;

	// Split into lines and diff each line pair
	const origLines = orig.split("\n");
	const modLines = mod.split("\n");
	const maxLen = Math.max(origLines.length, modLines.length);

	let html = '<div class="diff-inline">';

	for (let i = 0; i < maxLen; i++) {
		const oLine = i < origLines.length ? origLines[i] : "";
		const nLine = i < modLines.length ? modLines[i] : "";

		html += `<div class="inline-line"><span class="inline-num">${i + 1}</span>`;

		if (oLine === nLine) {
			// Unchanged line
			html += escapeHtml(oLine) || " ";
		} else {
			// Changed line: word-level inline diff
			const wordDiff = Diff.diffWords(oLine, nLine);
			wordDiff.forEach((w) => {
				const esc = escapeHtml(w.value);
				if (w.removed) {
					html += `<span class="inline-del">${esc}</span>`;
				} else if (w.added) {
					html += `<span class="inline-add">${esc}</span>`;
				} else {
					html += esc;
				}
			});
		}

		html += "</div>";
	}

	html += "</div>";
	body.innerHTML = html;
}

// ===== UNIFIED VIEW =====
function renderUnified(body) {
	let html = '<table class="diff-table">';
	let oldLine = 1,
		newLine = 1;

	const groups = groupDiffParts(lastDiff);

	groups.forEach((group) => {
		if (group.type === "change") {
			// Paired removed+added: apply word-level diff per line pair
			const oldLines = group.removed.value.replace(/\n$/, "").split("\n");
			const newLines = group.added.value.replace(/\n$/, "").split("\n");
			const maxLen = Math.max(oldLines.length, newLines.length);

			for (let j = 0; j < maxLen; j++) {
				const oLine = j < oldLines.length ? oldLines[j] : null;
				const nLine = j < newLines.length ? newLines[j] : null;

				if (oLine !== null && nLine !== null) {
					// Both exist: word-level diff
					const wordDiff = Diff.diffWords(oLine, nLine);
					let removedHtml = "",
						addedHtml = "";
					wordDiff.forEach((w) => {
						const esc = escapeHtml(w.value);
						if (w.added) {
							addedHtml += `<span class="word-add">${esc}</span>`;
						} else if (w.removed) {
							removedHtml += `<span class="word-del">${esc}</span>`;
						} else {
							removedHtml += esc;
							addedHtml += esc;
						}
					});
					html += `<tr class="diff-line removed">
              <td class="line-num">${oldLine++}</td>
              <td class="line-num"></td>
              <td class="line-sign">−</td>
              <td class="line-content">${removedHtml || " "}</td>
            </tr>`;
					html += `<tr class="diff-line added">
              <td class="line-num"></td>
              <td class="line-num">${newLine++}</td>
              <td class="line-sign">+</td>
              <td class="line-content">${addedHtml || " "}</td>
            </tr>`;
				} else if (oLine !== null) {
					html += `<tr class="diff-line removed">
              <td class="line-num">${oldLine++}</td>
              <td class="line-num"></td>
              <td class="line-sign">−</td>
              <td class="line-content">${escapeHtml(oLine) || " "}</td>
            </tr>`;
				} else {
					html += `<tr class="diff-line added">
              <td class="line-num"></td>
              <td class="line-num">${newLine++}</td>
              <td class="line-sign">+</td>
              <td class="line-content">${escapeHtml(nLine) || " "}</td>
            </tr>`;
				}
			}
		} else if (group.type === "added") {
			const lines = group.part.value.replace(/\n$/, "").split("\n");
			lines.forEach((line) => {
				html += `<tr class="diff-line added">
              <td class="line-num"></td>
              <td class="line-num">${newLine++}</td>
              <td class="line-sign">+</td>
              <td class="line-content">${escapeHtml(line) || " "}</td>
            </tr>`;
			});
		} else if (group.type === "removed") {
			const lines = group.part.value.replace(/\n$/, "").split("\n");
			lines.forEach((line) => {
				html += `<tr class="diff-line removed">
              <td class="line-num">${oldLine++}</td>
              <td class="line-num"></td>
              <td class="line-sign">−</td>
              <td class="line-content">${escapeHtml(line) || " "}</td>
            </tr>`;
			});
		} else {
			const lines = group.part.value.replace(/\n$/, "").split("\n");
			lines.forEach((line) => {
				html += `<tr class="diff-line unchanged">
              <td class="line-num">${oldLine}</td>
              <td class="line-num">${newLine}</td>
              <td class="line-sign"></td>
              <td class="line-content">${escapeHtml(line) || " "}</td>
            </tr>`;
				oldLine++;
				newLine++;
			});
		}
	});

	html += "</table>";
	body.innerHTML = html;
}

// ===== SPLIT VIEW =====
function renderSplit(body) {
	const groups = groupDiffParts(lastDiff);

	let html = '<table class="diff-table-split">';
	let oldLine = 1,
		newLine = 1;

	groups.forEach((group) => {
		if (group.type === "change") {
			const oldLines = group.removed.value.replace(/\n$/, "").split("\n");
			const newLines = group.added.value.replace(/\n$/, "").split("\n");
			const maxLen = Math.max(oldLines.length, newLines.length);

			// Word-level diff for changed pairs
			for (let j = 0; j < maxLen; j++) {
				const oLine = j < oldLines.length ? oldLines[j] : null;
				const nLine = j < newLines.length ? newLines[j] : null;

				let leftContent = "",
					rightContent = "";
				let leftClass = "",
					rightClass = "";
				let leftNum = "",
					rightNum = "";
				let leftSign = "",
					rightSign = "";

				if (oLine !== null && nLine !== null) {
					// Word diff
					const wordDiff = Diff.diffWords(oLine, nLine);
					let leftHtml = "",
						rightHtml = "";
					wordDiff.forEach((w) => {
						const esc = escapeHtml(w.value);
						if (w.added)
							rightHtml += `<span class="word-add">${esc}</span>`;
						else if (w.removed)
							leftHtml += `<span class="word-del">${esc}</span>`;
						else {
							leftHtml += esc;
							rightHtml += esc;
						}
					});
					leftContent = leftHtml || " ";
					rightContent = rightHtml || " ";
					leftClass = "removed";
					rightClass = "added";
					leftNum = oldLine++;
					rightNum = newLine++;
					leftSign = "−";
					rightSign = "+";
				} else if (oLine !== null) {
					leftContent = escapeHtml(oLine) || " ";
					leftClass = "removed";
					leftNum = oldLine++;
					leftSign = "−";
					rightContent = "";
					rightClass = "";
				} else {
					rightContent = escapeHtml(nLine) || " ";
					rightClass = "added";
					rightNum = newLine++;
					rightSign = "+";
					leftContent = "";
					leftClass = "";
				}

				html += `<tr class="diff-line">
              <td class="line-num half-left ${leftClass}">${leftNum}</td>
              <td class="line-sign ${leftClass}">${leftSign}</td>
              <td class="${leftClass}" style="width:calc(50% - 60px)">${leftContent}</td>
              <td class="split-divider"></td>
              <td class="line-num half-right ${rightClass}">${rightNum}</td>
              <td class="line-sign ${rightClass}">${rightSign}</td>
              <td class="${rightClass}" style="width:calc(50% - 60px)">${rightContent}</td>
            </tr>`;
			}
		} else if (group.type === "added") {
			const lines = group.part.value.replace(/\n$/, "").split("\n");
			lines.forEach((line) => {
				html += `<tr class="diff-line">
              <td class="line-num half-left"></td>
              <td class="line-sign"></td>
              <td style="width:calc(50% - 60px)"></td>
              <td class="split-divider"></td>
              <td class="line-num half-right added">${newLine++}</td>
              <td class="line-sign added">+</td>
              <td class="added" style="width:calc(50% - 60px)">${escapeHtml(line) || " "}</td>
            </tr>`;
			});
		} else if (group.type === "removed") {
			const lines = group.part.value.replace(/\n$/, "").split("\n");
			lines.forEach((line) => {
				html += `<tr class="diff-line">
              <td class="line-num half-left removed">${oldLine++}</td>
              <td class="line-sign removed">−</td>
              <td class="removed" style="width:calc(50% - 60px)">${escapeHtml(line) || " "}</td>
              <td class="split-divider"></td>
              <td class="line-num half-right"></td>
              <td class="line-sign"></td>
              <td style="width:calc(50% - 60px)"></td>
            </tr>`;
			});
		} else {
			const lines = group.part.value.replace(/\n$/, "").split("\n");
			lines.forEach((line) => {
				html += `<tr class="diff-line">
              <td class="line-num half-left">${oldLine}</td>
              <td class="line-sign"></td>
              <td style="width:calc(50% - 60px)">${escapeHtml(line) || " "}</td>
              <td class="split-divider"></td>
              <td class="line-num half-right">${newLine}</td>
              <td class="line-sign"></td>
              <td style="width:calc(50% - 60px)">${escapeHtml(line) || " "}</td>
            </tr>`;
				oldLine++;
				newLine++;
			});
		}
	});

	html += "</table>";
	body.innerHTML = html;
}

// ===== MODE SWITCH =====
function switchMode(mode) {
	currentMode = mode;
	document.querySelectorAll(".diff-mode-btn").forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.mode === mode);
	});
	if (lastDiff) renderDiff();
}

// ===== SWAP =====
function swapTexts() {
	const temp = originalEl.value;
	originalEl.value = modifiedEl.value;
	modifiedEl.value = temp;
	// Update char counts
	document.getElementById("countOriginal").textContent =
		originalEl.value.length.toLocaleString("vi-VN") + " ký tự";
	document.getElementById("countModified").textContent =
		modifiedEl.value.length.toLocaleString("vi-VN") + " ký tự";
}

// ===== CLEAR =====
function clearAll() {
	originalEl.value = "";
	modifiedEl.value = "";
	document.getElementById("countOriginal").textContent = "0 ký tự";
	document.getElementById("countModified").textContent = "0 ký tự";
	document.getElementById("diffContainer").classList.remove("visible");
	document.getElementById("statsBar").classList.remove("visible");
	lastDiff = null;
}

// ===== HELPERS =====
function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// ===== KEYBOARD SHORTCUT =====
document.addEventListener("keydown", (e) => {
	if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
		e.preventDefault();
		runCompare();
	}
});
