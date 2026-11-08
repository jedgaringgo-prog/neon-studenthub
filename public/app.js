const API = "/api";

const studentTable = document.getElementById("studentTable");
const modalBackdrop = document.getElementById("modalBackdrop");
const studentForm = document.getElementById("studentForm");
const searchInput = document.getElementById("searchInput");
const courseFilter = document.getElementById("courseFilter");

let students = [];
let editingId = null;
let toastTimer;

// API REQUEST
async function request(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

// LOAD DASHBOARD
async function loadDashboard() {
    try {
        const [studentData, stats] = await Promise.all([
            request(`${API}/students`),
            request(`${API}/stats`)
        ]);

        students = studentData;

        document.getElementById("totalStudents").textContent = stats.total;
        document.getElementById("activeStudents").textContent = stats.active;
        document.getElementById("inactiveStudents").textContent = stats.inactive;

        updateCourseFilter();
        renderStudents();

    } catch (error) {
        studentTable.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Unable to connect to database.
                    Please check your server.
                </td>
            </tr>
        `;

        showToast(error.message, true);
    }
}

// DISPLAY STUDENTS
function renderStudents() {
    const search = searchInput.value.toLowerCase().trim();
    const selectedCourse = courseFilter.value;

    const filtered = students.filter(student => {
        const fullName =
            `${student.first_name} ${student.last_name}`.toLowerCase();

        const matchesSearch =
            fullName.includes(search) ||
            student.email.toLowerCase().includes(search);

        const matchesCourse =
            !selectedCourse || student.course === selectedCourse;

        return matchesSearch && matchesCourse;
    });

    document.getElementById("recordCount").textContent =
        `Showing ${filtered.length} of ${students.length} students`;

    if (!filtered.length) {
        studentTable.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No student records found.
                </td>
            </tr>
        `;
        return;
    }

    studentTable.innerHTML = filtered.map(student => `
        <tr>
            <td class="student-id">#${student.id}</td>

            <td class="student-name">
                ${escapeHTML(student.first_name)}
                ${escapeHTML(student.last_name)}
            </td>

            <td>${escapeHTML(student.email)}</td>
            <td>${escapeHTML(student.contact_number || "—")}</td>
            <td>${escapeHTML(student.course)}</td>
            <td>${escapeHTML(student.year_level)}</td>

            <td>
                <span class="status ${student.status}">
                    ${student.status}
                </span>
            </td>

            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn"
                        data-action="edit" data-id="${student.id}">
                        Edit
                    </button>

                    <button class="action-btn delete-btn"
                        data-action="delete" data-id="${student.id}">
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

// PREVENT HTML INJECTION
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// COURSE FILTER
function updateCourseFilter() {
    const current = courseFilter.value;

    const courses = [...new Set(
        students.map(student => student.course)
    )].sort();

    courseFilter.innerHTML =
        '<option value="">All Courses</option>' +
        courses.map(course => `
            <option value="${escapeHTML(course)}">
                ${escapeHTML(course)}
            </option>
        `).join("");

    courseFilter.value = courses.includes(current) ? current : "";
}

// OPEN MODAL
function openModal(student = null) {
    studentForm.reset();
    document.getElementById("formError").textContent = "";

    editingId = student ? student.id : null;

    document.getElementById("modalTitle").textContent =
        student ? "Edit Student" : "Add New Student";

    document.getElementById("saveBtn").textContent =
        student ? "Update Student" : "Save Student";

    if (student) {
        document.getElementById("first_name").value = student.first_name;
        document.getElementById("last_name").value = student.last_name;
        document.getElementById("email").value = student.email;
        document.getElementById("contact_number").value =
            student.contact_number || "";
        document.getElementById("course").value = student.course;
        document.getElementById("year_level").value = student.year_level;
        document.getElementById("status").value = student.status;
    }

    modalBackdrop.classList.add("show");
}

// CLOSE MODAL
function closeModal() {
    modalBackdrop.classList.remove("show");
    editingId = null;
}

document.getElementById("addStudentBtn").addEventListener("click", () => {
    openModal();
});

document.getElementById("welcomeAdd").addEventListener("click", () => {
    openModal();
});

document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", event => {
    if (event.target === modalBackdrop) closeModal();
});

// SAVE OR UPDATE
studentForm.addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        first_name: document.getElementById("first_name").value.trim(),
        last_name: document.getElementById("last_name").value.trim(),
        email: document.getElementById("email").value.trim(),
        contact_number:
            document.getElementById("contact_number").value.trim(),
        course: document.getElementById("course").value,
        year_level: document.getElementById("year_level").value,
        status: document.getElementById("status").value
    };

    const saveBtn = document.getElementById("saveBtn");
    const formError = document.getElementById("formError");

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    formError.textContent = "";

    try {
        if (editingId) {
            await request(`${API}/students/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(data)
            });

            showToast("Student updated successfully!");
        } else {
            await request(`${API}/students`, {
                method: "POST",
                body: JSON.stringify(data)
            });

            showToast("Student added successfully!");
        }

        closeModal();
        await loadDashboard();

    } catch (error) {
        formError.textContent = error.message;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = editingId ? "Update Student" : "Save Student";
    }
});

// EDIT / DELETE ACTIONS
studentTable.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    if (action === "edit") {
        const student = students.find(item => item.id === id);

        if (student) openModal(student);
    }

    if (action === "delete") {
        const student = students.find(item => item.id === id);

        if (!student) return;

        const confirmed = confirm(
            `Are you sure you want to delete ${student.first_name} ${student.last_name}?`
        );

        if (!confirmed) return;

        try {
            await request(`${API}/students/${id}`, {
                method: "DELETE"
            });

            showToast("Student deleted successfully!");
            await loadDashboard();

        } catch (error) {
            showToast(error.message, true);
        }
    }
});

// SEARCH AND FILTER
searchInput.addEventListener("input", renderStudents);
courseFilter.addEventListener("change", renderStudents);

// TOAST
function showToast(message, isError = false) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.style.borderColor = isError ? "#ff5277" : "#a6ff4d";
    toast.style.color = isError ? "#ff5277" : "#a6ff4d";

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// INITIALIZE
loadDashboard();