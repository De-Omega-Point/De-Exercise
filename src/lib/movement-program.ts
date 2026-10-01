export type MovementPrescription = {
  name: string;
  dose: string;
  cue?: string;
};

export type MovementDay = {
  id: string;
  day: string;
  theme: string;
  gymFocus: string;
  gym: MovementPrescription[];
  movementFocus: string;
  movement: MovementPrescription[];
  note?: string;
};

export const dailyBaseline: MovementPrescription[] = [
  { name: "Neck + shoulder CARs", dose: "1 min", cue: "Slow circles. Own the full range." },
  { name: "Wrist preparation", dose: "1 min", cue: "Flexion, extension and gentle loaded circles." },
  { name: "Cat-cow + spinal waves", dose: "2 min", cue: "Segment the spine instead of rushing." },
  { name: "Hip CARs + 90/90 switches", dose: "2 min", cue: "Keep the pelvis controlled." },
  { name: "Cossack squats", dose: "2 × 5 / side", cue: "Move only as deep as you can control." },
  { name: "Deep squat hold + rotations", dose: "60–90 sec", cue: "Breathe and keep the feet planted." },
  { name: "Active pike compression", dose: "2 × 10", cue: "Lift with the hip flexors, do not yank the hamstrings." },
  { name: "Bear → ape → crab flow", dose: "3 min", cue: "Smooth transitions over speed." },
];

export const eveningReset: MovementPrescription[] = [
  { name: "90/90 hips", dose: "60 sec / side" },
  { name: "Child's-pose reach", dose: "60 sec" },
  { name: "Couch stretch", dose: "60 sec / side" },
  { name: "Hamstring stretch", dose: "60 sec / side" },
  { name: "Deep squat", dose: "60–90 sec" },
  { name: "Gentle spinal rotation", dose: "60 sec / side" },
  { name: "Slow breathing", dose: "2 min" },
];

export const movementWeek: MovementDay[] = [
  {
    id: "monday",
    day: "Monday",
    theme: "Ground control",
    gymFocus: "Pull + Front Lever + Core",
    gym: [
      { name: "Scapular pull-ups + hollow body", dose: "2 prep rounds" },
      { name: "Pull-ups", dose: "4 × 6–10" },
      { name: "Front lever progression", dose: "4 × 8–15 sec" },
      { name: "Chest-supported row", dose: "3 × 8–12" },
      { name: "Straight-arm pulldown", dose: "3 × 10–15" },
      { name: "Face pulls", dose: "3 × 12–15" },
      { name: "Hanging knee / leg raises", dose: "3 × 8–12" },
    ],
    movementFocus: "Ground locomotion",
    movement: [
      { name: "Bear crawl", dose: "2 × 30–45 sec" },
      { name: "Frog travel", dose: "2 × 20–30 sec" },
      { name: "Cossack flow", dose: "2 × 5 / side" },
      { name: "Shoulder roll", dose: "3 / side" },
      { name: "Deep squat transition", dose: "2 min flow" },
    ],
  },
  {
    id: "tuesday",
    day: "Tuesday",
    theme: "Shoulders + sideways",
    gymFocus: "Push + Handstand + Planche",
    gym: [
      { name: "Wall handstand", dose: "4 × 20–40 sec" },
      { name: "Handstand kick-up practice", dose: "5–8 attempts" },
      { name: "Planche lean", dose: "4 × 15–25 sec" },
      { name: "Dips", dose: "4 × 6–10" },
      { name: "Pike push-ups / HSPU progression", dose: "3 × 6–10" },
      { name: "Chest press", dose: "3 × 8–12" },
      { name: "Scapular push-ups", dose: "2 × 12–15" },
    ],
    movementFocus: "Lateral movement + cartwheel line",
    movement: [
      { name: "Shoulder CARs", dose: "1 min" },
      { name: "Thoracic rotations", dose: "2 × 6 / side" },
      { name: "Ape travel", dose: "3 × 20–30 sec" },
      { name: "Crab reach", dose: "2 × 5 / side" },
      { name: "Cartwheel line drills", dose: "6–10 controlled reps" },
    ],
  },
  {
    id: "wednesday",
    day: "Wednesday",
    theme: "Spine + flow",
    gymFocus: "Movement-only recovery day",
    gym: [],
    movementFocus: "Mobility + soft acrobatics",
    movement: [
      { name: "90/90 + Cossack + ankle flow", dose: "8 min" },
      { name: "Active pike + pancake", dose: "8 min" },
      { name: "Bear → leopard → lizard", dose: "6 min" },
      { name: "Ape → monkey → crab", dose: "6 min" },
      { name: "Forward + shoulder rolls", dose: "6–8 reps" },
      { name: "Candlestick + cartwheel progression", dose: "8 min" },
      { name: "Free movement flow", dose: "3–5 min" },
    ],
    note: "No heavy strength work. Finish feeling better than you started.",
  },
  {
    id: "thursday",
    day: "Thursday",
    theme: "Legs + locomotion",
    gymFocus: "Legs + Single-Leg Strength",
    gym: [
      { name: "Squat or leg press", dose: "4 × 6–10" },
      { name: "Romanian deadlift", dose: "3 × 8–10" },
      { name: "Bulgarian split squat", dose: "3 × 8 / side" },
      { name: "Assisted pistol squat", dose: "3 × 5 / side" },
      { name: "Hamstring curl", dose: "3 × 10–15" },
      { name: "Calf raises", dose: "3 × 12–20" },
      { name: "Tibialis raises", dose: "2 × 15–20" },
    ],
    movementFocus: "Hips + animal movement",
    movement: [
      { name: "Cossack travel", dose: "2 × 5 / side" },
      { name: "Duck walk", dose: "2 × 20 sec" },
      { name: "Frog movement", dose: "2 × 20 sec" },
      { name: "Deep squat rotations", dose: "2 × 5 / side" },
      { name: "Floor-to-stand transitions", dose: "5 controlled reps" },
    ],
  },
  {
    id: "friday",
    day: "Friday",
    theme: "Lateral power",
    gymFocus: "Human Flag + Athletic Upper Body",
    gym: [
      { name: "Human flag support holds", dose: "4 quality sets" },
      { name: "Vertical flag progression", dose: "3–4 sets" },
      { name: "Pull-ups / chin-ups", dose: "3 × 6–10" },
      { name: "Dips", dose: "3 × 6–10" },
      { name: "Cable row", dose: "3 × 8–12" },
      { name: "Lateral raise", dose: "3 × 12–15" },
      { name: "Pallof press", dose: "3 × 10 / side" },
      { name: "Side plank", dose: "2 × 30–45 sec" },
    ],
    movementFocus: "Dynamic lateral flow",
    movement: [
      { name: "Monkey travel", dose: "3 × 20–30 sec" },
      { name: "Lateral beast", dose: "3 × 20 sec" },
      { name: "Cartwheel", dose: "6–10 controlled reps" },
      { name: "Squat → kick-through", dose: "2 × 5 / side" },
      { name: "Connected flow", dose: "3 min" },
    ],
  },
  {
    id: "saturday",
    day: "Saturday",
    theme: "Movement playground",
    gymFocus: "Optional Full-Body Athletic Session",
    gym: [
      { name: "Farmer carries", dose: "4 × 30–40 m" },
      { name: "Pull-ups", dose: "3 × comfortable reps" },
      { name: "Goblet squat", dose: "3 × 8–12" },
      { name: "Walking lunges", dose: "3 × 8 / side" },
      { name: "Box step-ups", dose: "3 × 8 / side" },
      { name: "Light jumps", dose: "3 × 5" },
    ],
    movementFocus: "Play + connect",
    movement: [
      { name: "Bear crawl", dose: "2 × 30 sec" },
      { name: "Ape → crab transitions", dose: "3 min" },
      { name: "Rolls", dose: "6–8 reps" },
      { name: "Cartwheel practice", dose: "8 min" },
      { name: "Free movement sequence", dose: "5 min" },
    ],
    note: "If fatigue is high, skip the gym block and keep this movement-only.",
  },
  {
    id: "sunday",
    day: "Sunday",
    theme: "Restore + explore",
    gymFocus: "Recovery",
    gym: [],
    movementFocus: "Long mobility + flexibility",
    movement: [
      { name: "Pike", dose: "2 × 60 sec" },
      { name: "Pancake", dose: "2 × 60 sec" },
      { name: "Hip-flexor stretch", dose: "2 × 60 sec / side" },
      { name: "90/90 hips", dose: "2 min" },
      { name: "Deep squat", dose: "2 min" },
      { name: "Thoracic + shoulder mobility", dose: "5 min" },
      { name: "Wrists + ankles", dose: "4 min" },
      { name: "Gentle locomotion", dose: "5–10 min" },
    ],
    note: "No performance targets today. Restore range and explore.",
  },
];
