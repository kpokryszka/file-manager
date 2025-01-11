document.addEventListener("DOMContentLoaded", () => {
	const fileList = document.getElementById("file-list");
	const notificationContainer = document.getElementById("notification-container");
	const uploadForm = document.getElementById("upload-form");
	const fileInput = document.getElementById("file-input");
	const progressContainer = document.getElementById("progress-container");
	const uploadProgress = document.getElementById("upload-progress");
	const ftpDetails = document.getElementById("ftp-details");

	// Utility function to show notifications
	function showNotification(message, type = "success") {
		const notification = document.createElement("div");
		notification.className = `notification ${type}`;
		notification.textContent = message;
		notificationContainer.appendChild(notification);
		setTimeout(() => notification.remove(), 4000);
	}

	// Upload file with progress tracking
	async function uploadFile(file) {
		const formData = new FormData();
		formData.append("file", file);

		progressContainer.style.display = "block";
		uploadProgress.value = 0;

		try {
			const xhr = new XMLHttpRequest();
			xhr.open("POST", "/upload", true);

			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					const percent = (event.loaded / event.total) * 100;
					uploadProgress.value = percent;
				}
			};

			xhr.onload = () => {
				if (xhr.status === 200) {
					showNotification("File uploaded successfully!", "success");
					fetchFiles();
					uploadForm.reset();
					progressContainer.style.display = "none";
				} else {
					showNotification("Failed to upload file.", "error");
				}
			};

			xhr.onerror = () => showNotification("Error during file upload.", "error");

			xhr.send(formData);
		} catch (error) {
			showNotification("Error uploading file.", "error");
		}
	}

	uploadForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const file = fileInput.files[0];
		if (file) {
			uploadFile(file);
		} else {
			showNotification("Please select a file to upload.", "error");
		}
	});

	// Fetch FTP credentials and file data from the server
	async function fetchFiles(searchQuery = "") {
		fileList.innerHTML = "<li>Loading...</li>";
		try {
			const response = await fetch(`/files?search=${encodeURIComponent(searchQuery)}`);
			if (!response.ok) throw new Error("Failed to load files from server");

			const data = await response.json();
			const { files, ftpCredentials } = data;
			const { host, user, password, port } = ftpCredentials;

			ftpDetails.innerHTML = `
			<div class="ftp-info">
				<strong>Host:</strong> ${host}<br>
				<strong>Port:</strong> ${port}<br>
				<strong>Username:</strong> ${user}<br>
				<strong>Password:</strong> ${password}
			</div>
			<div class="ftp-link-container">
				<div class="ftp-link">
					<a>ftp://${user}:${password}@${host}:${port}/</a>
				</div>
				<div class="ftp-link-button">
					<button class="copy-btn" data-ftp-url="ftp://${user}:${password}@${host}:${port}/">Copy</button>
				</div>
			</div>
			`;

			const copyButton = ftpDetails.querySelector(".copy-btn");
			copyButton.addEventListener("click", () => {
				const ftpUrl = copyButton.dataset.ftpUrl;
				navigator.clipboard.writeText(ftpUrl).then(() => {
					showNotification("FTP link copied to clipboard", "success");
				}).catch(() => {
					showNotification("Failed to copy FTP link", "error");
				});
			});

			fileList.innerHTML = "";
			files.forEach((file) => {
				const listItem = document.createElement("li");
				const ftpUrl = `ftp://${user}:${password}@${host}:${port}/${file.name}`;

				listItem.innerHTML = `
					<div class="file-info">
						<span class="file-name">${file.name}</span>
						<button class="delete" data-filename="${file.name}">Delete</button>
						<button class="download" data-filename="${file.name}">Download</button>
					</div>
					<div class="ftp-link-container">
						<span class="ftp-link">${ftpUrl}</span>
						<button class="copy-btn" data-ftp-url="${ftpUrl}">Copy</button>
					</div>
				`;

				fileList.appendChild(listItem);
			});
		} catch (error) {
			showNotification("Failed to load files.", "error");
		}
	}

	document.getElementById("search-input").addEventListener("input", (e) => {
		const searchQuery = e.target.value;
		fetchFiles(searchQuery);
	});

	fileList.addEventListener("click", async (e) => {
		if (e.target.tagName === "BUTTON") {
			const filename = e.target.dataset.filename;

			if (e.target.classList.contains("download")) {
				window.location.href = `/download/${filename}`;
			} else if (e.target.classList.contains("delete")) {
				try {
					const response = await fetch(`/delete/${filename}`, { method: "DELETE" });
					if (response.ok) {
						showNotification("File deleted successfully", "success");
						fetchFiles();
					} else {
						showNotification("Failed to delete file", "error");
					}
				} catch (error) {
					showNotification("Error deleting file", "error");
				}
			} else if (e.target.classList.contains("copy-btn")) {
				const ftpUrl = e.target.dataset.ftpUrl;
				navigator.clipboard.writeText(ftpUrl).then(() => {
					showNotification("FTP link copied to clipboard", "success");
				}).catch(() => {
					showNotification("Failed to copy FTP link", "error");
				});
			}
		}
	});

	fetchFiles();
});
