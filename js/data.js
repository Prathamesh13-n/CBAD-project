/* ============================================================
   CDAD :: data.js
   Runs once (guarded by cdad_seed_version) to populate LocalStorage
   with a starting dataset. Bump SEED_VERSION below whenever the
   roster or demo data changes — this forces a clean reseed instead
   of silently keeping old cached data. After this runs, NOTHING in
   the app is hardcoded — every screen reads from these keys.
   ============================================================ */

const SEED_VERSION = 'roster-2026-08-hanfa-parth-prathamesh-v2';

function seedIfEmpty() {
  const stored = localStorage.getItem(CDAD_KEYS.SEEDED);
  if (stored === SEED_VERSION) return; // already on the current dataset — leave live edits alone

  // Roster/version changed since last load — wipe the old session so
  // nobody stays logged in as a student/faculty ID that no longer exists.
  localStorage.removeItem(CDAD_KEYS.CURRENT_USER);

  const now = Date.now();
  const iso = (daysFromNow) => new Date(now + daysFromNow * 86400000).toISOString();

  /* ---- Faculty ---- */
  const faculty = [
    {
      id: generateId('FAC'),
      displayId: 'FAC001',
      name: ' Prof. Vilas Khedekar ',
      email: 'faculty@cdad.edu',
      password: 'faculty123',
      phone: '9812345670',
      department: 'Computer Engineering',
      designation: 'Associate Professor',
      avatar: '',
      session: '2025-2026'
    }
  ];
  saveData(CDAD_KEYS.FACULTY, faculty);

  /* ---- Students (real roster) ----
     User ID (displayId) is exactly as provided — this is what's used
     to log in. Email is stored for reference only, never used to log in. */
  const students = [
    {
      id: generateId('STU'),
      displayId: 'ADT24SOCB0001',
      name: 'Hanfa',
      email: 'hanfa@cdad.edu',
      password: 'PASS123',
      phone: '',
      course: 'Computer Engineering',
      year: '3rd Year',
      department: 'Computer Engineering',
      group: 'G01',
      role: 'Team Leader',
      status: 'Active',
      avatar: '',
      connections: []
    },
    {
      id: generateId('STU'),
      displayId: 'ADT24SOCB0002',
      name: 'Parth',
      email: 'parth@cdad.edu',
      password: 'PASS123',
      phone: '',
      course: 'Computer Engineering',
      year: '3rd Year',
      department: 'Computer Engineering',
      group: 'G01',
      role: 'Member',
      status: 'Active',
      avatar: '',
      connections: []
    },
    {
      id: generateId('STU'),
      displayId: 'ADT24SOCB0820',
      name: 'Prathamesh',
      email: 'prathamesh@cdad.edu',
      password: 'PASS123',
      phone: '',
      course: 'Computer Engineering',
      year: '3rd Year',
      department: 'Computer Engineering',
      group: 'G01',
      role: 'Member',
      status: 'Active',
      avatar: '',
      connections: []
    },
    {
      id: generateId('STU'),
      displayId: 'ADT24SOCB0020',
      name: 'Prince',
      email: 'prince@cdad.edu',
      password: 'PASS123',
      phone: '',
      course: 'Computer Engineering',
      year: '3rd Year',
      department: 'Computer Engineering',
      group: 'G03',
      role: 'Member',
      status: 'Active',
      avatar: '',
      connections: []
    }
  ];
  
  saveData(CDAD_KEYS.STUDENTS, students);

  

  /* ---- Groups ---- */
  const groups = [
    {
      id: generateId('GRP'),
      displayId: 'G01',
      name: 'Group Alpha',
      teamLeader: 'ADT24SOCB0001',
      members: students.map((s) => s.displayId),
      project: 'P01',
      status: 'Active',
      progress: 0
    }
  ];
  saveData(CDAD_KEYS.GROUPS, groups);

  /* ---- Projects ---- */
  const stagesA = {
    Planning: 'Completed', 'Requirement Analysis': 'Completed', Design: 'In Progress',
    Development: 'Pending', Testing: 'Pending', Presentation: 'Pending', Submission: 'Pending'
  };
  const projects = [
    {
      id: generateId('PRJ'),
      displayId: 'P01',
      title: 'Smart Campus Attendance System',
      description: 'A facial-recognition based attendance tracker for classrooms.',
      group: 'G01',
      teamLeader: 'ADT24SOCB0001',
      startDate: iso(-20),
      deadline: iso(40),
      progress: computeProgressFromStages(stagesA),
      status: 'Active',
      githubUrl: 'https://github.com/cdad-group-01/smart-attendance',
      repoName: 'smart-attendance',
      branch: 'main',
      stages: stagesA
    }
  ];
  saveData(CDAD_KEYS.PROJECTS, projects);

  // sync group progress from its project
  groups[0].progress = projects[0].progress;
  saveData(CDAD_KEYS.GROUPS, groups);

  /* ---- Marks ---- */
  const marks = [
    { id: generateId('MRK'), studentId: 'ADT24SOCB0001', internal: 18, internalMax: 20, project: 35, projectMax: 40, presentation: 16, presentationMax: 20, viva: 8, vivaMax: 10 },
    { id: generateId('MRK'), studentId: 'ADT24SOCB0002', internal: 16, internalMax: 20, project: 32, projectMax: 40, presentation: 15, presentationMax: 20, viva: 7, vivaMax: 10 },
    { id: generateId('MRK'), studentId: 'ADT24SOCB0820', internal: 17, internalMax: 20, project: 34, projectMax: 40, presentation: 17, presentationMax: 20, viva: 9, vivaMax: 10 }
  ];
  saveData(CDAD_KEYS.MARKS, marks);

  /* ---- Presentations ---- */
  const presentations = [
    {
      id: generateId('PRE'),
      displayId: 'PRE001',
      group: 'G01',
      project: 'P01',
      date: iso(15),
      time: '10:00',
      venue: 'Seminar Hall 1',
      faculty: 'FAC001',
      status: 'Scheduled',
      notes: 'Bring live demo on laptop.'
    }
  ];
  saveData(CDAD_KEYS.PRESENTATIONS, presentations);

  /* ---- Requests (faculty-facing academic requests) ---- */
  const requests = [
    {
      id: generateId('REQ'),
      displayId: 'REQ001',
      student: 'ADT24SOCB0002',
      type: 'General Request',
      group: 'G01',
      message: 'Requesting an extension for the design phase deliverable.',
      date: iso(-2),
      status: 'Pending',
      response: ''
    }
  ];
  saveData(CDAD_KEYS.REQUESTS, requests);

  /* ---- Student-to-student requests (peer connection requests) ---- */
  const studentRequests = [
    {
      id: generateId('SREQ'),
      from: 'ADT24SOCB0820',
      to: 'ADT24SOCB0001',
      message: 'Hey, can we sync on the backend module this week?',
      date: iso(-1),
      status: 'Pending'
    }
  ];
  saveData(CDAD_KEYS.STUDENT_REQUESTS, studentRequests);

  /* ---- Notifications ---- */
  const notifications = [
    { id: generateId('NOTIF'), title: 'Welcome to CDAD', message: 'Your dashboard is ready.', type: 'info', recipient: 'all-students', date: iso(-5), read: false },
    { id: generateId('NOTIF'), title: 'Presentation Scheduled', message: 'Group Alpha presentation set for ' + formatDate(presentations[0].date) + '.', type: 'info', recipient: 'G01', date: iso(-4), read: false }
  ];
  saveData(CDAD_KEYS.NOTIFICATIONS, notifications);

  /* ---- Announcements ---- */
  const announcements = [
    {
      id: generateId('ANN'),
      title: 'Mid-term project reviews next week',
      message: 'All groups must submit a progress report before the review.',
      author: ' Prof. Vilas Khedekar ',
      date: iso(-1),
      priority: 'Important',
      status: 'Active'
    }
  ];
  saveData(CDAD_KEYS.ANNOUNCEMENTS, announcements);

  /* ---- Activity log ---- */
  const activity = [
    { id: generateId('ACT'), text: 'Student roster initialized', date: new Date(now - 5 * 86400000).toISOString() }
  ];
  saveData(CDAD_KEYS.ACTIVITY, activity);

  localStorage.setItem(CDAD_KEYS.SEEDED, SEED_VERSION);
}

seedIfEmpty();