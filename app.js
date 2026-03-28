/* ========================================
   COMPOUNDING CALCULATOR — APP LOGIC
   ======================================== */

// --- State ---
const state = {
  initialDeposit: 1000,
  monthlyContribution: 100,
  annualRate: 8,
  years: 20,
  applyTax: false,
  chartData: [],
  animationProgress: 0,
  animationFrame: null,
};

// --- Danish Tax Brackets (Aktieskat 2024/2025) ---
// 27% on gains up to DKK 61,000 (~€8,200)
// 42% on gains above that threshold
const DK_TAX = {
  lowerRate: 0.27,
  upperRate: 0.42,
  thresholdDKK: 61000,
  dkkToEur: 0.134,  // approximate EUR/DKK
  get thresholdEUR() {
    return Math.round(this.thresholdDKK * this.dkkToEur);
  }
};

// --- DOM Elements ---
const dom = {};

function cacheDom() {
  dom.initialDeposit = document.getElementById('initialDeposit');
  dom.monthlyContribution = document.getElementById('monthlyContribution');
  dom.rateSlider = document.getElementById('rateSlider');
  dom.rateValue = document.getElementById('rateValue');
  dom.yearsSlider = document.getElementById('yearsSlider');
  dom.yearsValue = document.getElementById('yearsValue');
  dom.resultAmount = document.getElementById('resultAmount');
  dom.totalContributed = document.getElementById('totalContributed');
  dom.interestEarned = document.getElementById('interestEarned');
  dom.multiplier = document.getElementById('multiplier');
  dom.taxToggle = document.getElementById('taxToggle');
  dom.taxInfo = document.getElementById('taxInfo');
  dom.taxDeducted = document.getElementById('taxDeducted');
  dom.interestLabel = document.getElementById('interestLabel');
  dom.taxRow = document.getElementById('taxRow');
  dom.canvas = document.getElementById('growthChart');
  dom.tooltip = document.getElementById('chartTooltip');
  dom.presetBtns = document.querySelectorAll('.preset-btn');
}

// --- Formatting ---
function formatCurrency(value) {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// --- Compound Interest Calculation ---
function calculate() {
  const { initialDeposit, monthlyContribution, annualRate, years, applyTax } = state;
  const monthlyRate = annualRate / 100 / 12;
  const data = [];

  let balance = initialDeposit;
  let totalContributed = initialDeposit;

  data.push({
    year: 0,
    balance: initialDeposit,
    totalContributed: initialDeposit,
    interestEarned: 0,
  });

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) + monthlyContribution;
    }
    totalContributed += monthlyContribution * 12;
    const interestEarned = balance - totalContributed;

    data.push({
      year: y,
      balance: balance,
      totalContributed: totalContributed,
      interestEarned: interestEarned,
    });
  }

  state.chartData = data;

  // Final values
  const finalBalance = data[data.length - 1].balance;
  const totalContrib = data[data.length - 1].totalContributed;
  const interest = data[data.length - 1].interestEarned;

  // Apply Danish tax on the interest (gains) if toggled
  let taxAmount = 0;
  let afterTaxBalance = finalBalance;

  if (applyTax && interest > 0) {
    taxAmount = calculateDanishTax(interest);
    afterTaxBalance = finalBalance - taxAmount;
  }

  // Update DOM
  const displayBalance = applyTax ? afterTaxBalance : finalBalance;
  animateValue(dom.resultAmount, displayBalance);
  dom.totalContributed.textContent = formatCurrency(totalContrib);

  // Show net or gross interest & update label
  if (applyTax && taxAmount > 0) {
    dom.interestEarned.textContent = formatCurrency(interest - taxAmount);
    dom.interestLabel.textContent = 'Net interest (after tax)';
    dom.taxRow.style.display = '';
    dom.taxDeducted.textContent = '−' + formatCurrency(taxAmount);
  } else {
    dom.interestEarned.textContent = formatCurrency(interest);
    dom.interestLabel.textContent = 'Interest earned';
    dom.taxRow.style.display = 'none';
  }

  const mult = totalContrib > 0 ? (displayBalance / totalContrib).toFixed(1) : '0';
  dom.multiplier.innerHTML = `Your money grew <strong>${mult}×</strong>`;

  // Animate chart
  startChartAnimation();
}

// --- Danish Tax Calculation ---
function calculateDanishTax(gains) {
  const threshold = DK_TAX.thresholdEUR;
  if (gains <= threshold) {
    return gains * DK_TAX.lowerRate;
  }
  return (threshold * DK_TAX.lowerRate) + ((gains - threshold) * DK_TAX.upperRate);
}

// --- Animate Result Number ---
let animValueFrame = null;
let currentDisplayValue = 0;

function animateValue(element, target) {
  if (animValueFrame) cancelAnimationFrame(animValueFrame);

  const start = currentDisplayValue;
  const diff = target - start;
  const duration = 600;
  const startTime = performance.now();

  function step(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const value = start + diff * ease;
    currentDisplayValue = value;
    element.textContent = formatCurrency(Math.round(value));

    if (progress < 1) {
      animValueFrame = requestAnimationFrame(step);
    } else {
      element.classList.add('bump');
      setTimeout(() => element.classList.remove('bump'), 500);
    }
  }

  animValueFrame = requestAnimationFrame(step);
}

// --- Chart Rendering ---
const chartConfig = {
  paddingTop: 40,
  paddingRight: 30,
  paddingBottom: 50,
  paddingLeft: 70,
  dotRadius: 4,
  lineWidth: 2.5,
};

function startChartAnimation() {
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  state.animationProgress = 0;

  function animate() {
    state.animationProgress += 0.025;
    if (state.animationProgress > 1) state.animationProgress = 1;

    drawChart(state.animationProgress);

    if (state.animationProgress < 1) {
      state.animationFrame = requestAnimationFrame(animate);
    }
  }

  state.animationFrame = requestAnimationFrame(animate);
}

function drawChart(progress) {
  const canvas = dom.canvas;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = chartConfig;
  const chartW = w - pl - pr;
  const chartH = h - pt - pb;

  const data = state.chartData;
  if (data.length < 2) return;

  ctx.clearRect(0, 0, w, h);

  // Calculate scales
  const maxBalance = Math.max(...data.map(d => d.balance));
  const maxY = Math.ceil(maxBalance / 1000) * 1000 || 1000;
  const totalYears = data.length - 1;

  function xPos(year) { return pl + (year / totalYears) * chartW; }
  function yPos(val) { return pt + chartH - (val / maxY) * chartH; }

  // --- Grid lines ---
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxY / gridLines) * i;
    const y = yPos(val);
    ctx.beginPath();
    ctx.moveTo(pl, y);
    ctx.lineTo(w - pr, y);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatAxisValue(val), pl - 10, y + 4);
  }

  // X-axis labels
  ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  const xStep = totalYears <= 10 ? 1 : totalYears <= 20 ? 2 : 5;
  for (let i = 0; i <= totalYears; i += xStep) {
    ctx.fillText(`Yr ${i}`, xPos(i), h - pb + 20);
  }

  // Determine how many points to draw based on animation progress
  const pointsToDraw = Math.floor(progress * totalYears) + 1;

  // --- Contribution area (purple) ---
  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(0));
  for (let i = 0; i <= pointsToDraw && i < data.length; i++) {
    ctx.lineTo(xPos(i), yPos(data[i].totalContributed));
  }
  ctx.lineTo(xPos(Math.min(pointsToDraw, totalYears)), yPos(0));
  ctx.closePath();

  const contribGrad = ctx.createLinearGradient(0, pt, 0, pt + chartH);
  contribGrad.addColorStop(0, 'rgba(232, 145, 45, 0.15)'); // Slack Orange Soft
  contribGrad.addColorStop(1, 'rgba(232, 145, 45, 0.02)');
  ctx.fillStyle = contribGrad;
  ctx.fill();

  // Contribution line
  ctx.beginPath();
  for (let i = 0; i <= pointsToDraw && i < data.length; i++) {
    const x = xPos(i);
    const y = yPos(data[i].totalContributed);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#e8912d'; // Slack Orange
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- Total balance area (green) ---
  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(data[0].balance));
  for (let i = 0; i <= pointsToDraw && i < data.length; i++) {
    ctx.lineTo(xPos(i), yPos(data[i].balance));
  }
  // Close to contribution line, not to zero — so we shade only the interest portion
  for (let i = Math.min(pointsToDraw, totalYears); i >= 0; i--) {
    if (i < data.length) {
      ctx.lineTo(xPos(i), yPos(data[i].totalContributed));
    }
  }
  ctx.closePath();

  const balanceGrad = ctx.createLinearGradient(0, pt, 0, pt + chartH);
  balanceGrad.addColorStop(0, 'rgba(34, 158, 217, 0.20)'); // Telegram Blue Soft
  balanceGrad.addColorStop(1, 'rgba(34, 158, 217, 0.02)');
  ctx.fillStyle = balanceGrad;
  ctx.fill();

  // Total balance line
  ctx.beginPath();
  for (let i = 0; i <= pointsToDraw && i < data.length; i++) {
    const x = xPos(i);
    const y = yPos(data[i].balance);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#229ed9'; // Telegram Blue
  ctx.lineWidth = chartConfig.lineWidth;
  ctx.shadowColor = 'rgba(34, 158, 217, 0.2)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // --- Dots on balance line ---
  if (progress >= 1) {
    for (let i = 0; i < data.length; i++) {
      const x = xPos(i);
      const y = yPos(data[i].balance);

      ctx.beginPath();
      ctx.arc(x, y, chartConfig.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#229ed9'; // Telegram Blue
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function formatAxisValue(val) {
  if (val >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `€${(val / 1000).toFixed(0)}K`;
  return `€${val}`;
}

// --- Chart Tooltip ---
function setupChartTooltip() {
  const canvas = dom.canvas;

  canvas.addEventListener('mousemove', (e) => {
    if (state.chartData.length < 2 || state.animationProgress < 1) {
      dom.tooltip.classList.remove('visible');
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const { paddingLeft: pl, paddingRight: pr } = chartConfig;
    const chartW = rect.width - pl - pr;
    const totalYears = state.chartData.length - 1;

    const yearFloat = ((mouseX - pl) / chartW) * totalYears;
    const year = Math.round(yearFloat);

    if (year < 0 || year > totalYears) {
      dom.tooltip.classList.remove('visible');
      return;
    }

    const d = state.chartData[year];
    const tooltip = dom.tooltip;

    tooltip.innerHTML = `
      <div class="tooltip-year">Year ${d.year}</div>
      <div class="tooltip-amount">${formatCurrency(d.balance)}</div>
      <div class="tooltip-interest">Interest: ${formatCurrency(d.interestEarned)}</div>
    `;

    // Position tooltip
    const xPos = pl + (year / totalYears) * chartW;
    let tooltipLeft = xPos + 12;
    if (tooltipLeft + 150 > rect.width) tooltipLeft = xPos - 160;

    const yScale = (rect.height - chartConfig.paddingTop - chartConfig.paddingBottom);
    const maxBalance = Math.max(...state.chartData.map(dd => dd.balance)) || 1;
    const yPos = chartConfig.paddingTop + yScale - (d.balance / (Math.ceil(maxBalance / 1000) * 1000)) * yScale;

    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = (yPos - 10) + 'px';
    tooltip.classList.add('visible');
  });

  canvas.addEventListener('mouseleave', () => {
    dom.tooltip.classList.remove('visible');
  });
}

// --- Preset Buttons ---
function setupPresets() {
  dom.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const rate = parseFloat(btn.dataset.rate);
      state.annualRate = rate;
      dom.rateSlider.value = rate;
      dom.rateValue.textContent = rate + '%';
      updateSliderFill(dom.rateSlider);

      // Highlight active
      dom.presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      calculate();
    });
  });
}

// --- "Try This Rate" Buttons ---
function setupTryRateButtons() {
  document.querySelectorAll('.try-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rate = parseFloat(btn.dataset.rate);
      state.annualRate = rate;
      dom.rateSlider.value = rate;
      dom.rateValue.textContent = rate + '%';
      updateSliderFill(dom.rateSlider);

      // Update presets
      dom.presetBtns.forEach(b => {
        b.classList.toggle('active', parseFloat(b.dataset.rate) === rate);
      });

      calculate();

      // Scroll to calculator
      document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// --- Slider Fill (visual) ---
function updateSliderFill(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, #229ed9 0%, #229ed9 ${pct}%, #f3f4f6 ${pct}%, #f3f4f6 100%)`;
}

// --- Tax Toggle ---
function setupTaxToggle() {
  dom.taxToggle.addEventListener('change', () => {
    state.applyTax = dom.taxToggle.checked;
    dom.taxInfo.classList.toggle('visible', dom.taxToggle.checked);
    calculate();
  });
}

// --- Event Binding ---
function bindEvents() {
  // Initial deposit
  dom.initialDeposit.addEventListener('input', () => {
    const val = parseFloat(dom.initialDeposit.value) || 0;
    state.initialDeposit = val;
    calculate();
  });

  // Monthly contribution
  dom.monthlyContribution.addEventListener('input', () => {
    const val = parseFloat(dom.monthlyContribution.value) || 0;
    state.monthlyContribution = val;
    calculate();
  });

  // Rate slider
  dom.rateSlider.addEventListener('input', () => {
    const val = parseFloat(dom.rateSlider.value);
    state.annualRate = val;
    dom.rateValue.textContent = val + '%';
    updateSliderFill(dom.rateSlider);

    // Clear preset active
    dom.presetBtns.forEach(b => {
      b.classList.toggle('active', parseFloat(b.dataset.rate) === val);
    });

    calculate();
  });

  // Years slider
  dom.yearsSlider.addEventListener('input', () => {
    const val = parseInt(dom.yearsSlider.value);
    state.years = val;
    dom.yearsValue.textContent = val + (val === 1 ? ' year' : ' years');
    updateSliderFill(dom.yearsSlider);
    calculate();
  });

  // Resize → redraw chart
  window.addEventListener('resize', () => {
    if (state.chartData.length > 1) {
      drawChart(state.animationProgress);
    }
  });
}

// --- Scroll Reveal ---
function setupScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
}

// --- Initialise ---
function init() {
  cacheDom();
  bindEvents();
  setupPresets();
  setupTryRateButtons();
  setupChartTooltip();
  setupTaxToggle();
  setupScrollReveal();

  // Set initial slider fills
  updateSliderFill(dom.rateSlider);
  updateSliderFill(dom.yearsSlider);

  // Initial calculation
  calculate();
}

document.addEventListener('DOMContentLoaded', init);
