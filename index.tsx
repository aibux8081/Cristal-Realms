/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- GEMINI AI DYNAMIC INITIALIZATION ---
let ai;
let isAiInitializing = false;

// This function dynamically imports and initializes the GoogleGenAI module.
// It ensures the core game can run offline and only loads AI features when needed.
async function initializeAi() {
  if (ai) return true; // Already initialized
  if (isAiInitializing) return false; // Initialization in progress
  isAiInitializing = true;

  // FIX: Cast HTML elements to their specific types to access properties like 'disabled'.
  const crystalBtn = document.getElementById('crystal-btn') as HTMLButtonElement;
  const arenaBtn = document.getElementById('arena-btn') as HTMLButtonElement;

  try {
    // Show loading state on buttons
    crystalBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> Loading AI...';
    arenaBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> Loading AI...';
    
    // Dynamically import the module using the import map from index.html
    const { GoogleGenAI } = await import('@google/genai');

    // This is a placeholder for the API key.
    // In a real application, this should be handled securely.
    // We assume process.env.API_KEY is available in the execution environment.
    if (!process.env.API_KEY) {
        console.error("API_KEY is not available. AI features will be disabled.");
        throw new Error("API Key not found.");
    }
    
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    showNotification('AI features are now online!', 'success');
    return true;
  } catch (error) {
    console.error('Failed to initialize AI:', error);
    showNotification(
      'AI features are unavailable. Please check your internet connection.',
      'error'
    );
    // Disable AI-dependent buttons if initialization fails
    crystalBtn.disabled = true;
    arenaBtn.disabled = true;
    return false;
  } finally {
    isAiInitializing = false;
    // Restore original button text
    crystalBtn.innerHTML = '<i class="fas fa-magic"></i> Ask the Crystal';
    arenaBtn.innerHTML = '<i class="fas fa-shield-halved"></i> Arena';
  }
}


// --- GAME CONFIGURATION ---
const GAME_CONFIG = {
  PLAYER_BASE_HEALTH: 100,
  HEALTH_PER_LEVEL: 15,
  XP_TO_LEVEL_1: 100,
  XP_LEVEL_MULTIPLIER: 1.5,
  LEVEL_UP_DIAMOND_REWARD_MULTIPLIER: 25,
  PORTAL_BASE_MIN_DIAMONDS: 1,
  PORTAL_BASE_MAX_DIAMONDS: 5,
  PORTAL_XP_REWARD: 10,
  COMBAT_CHANCE: 0.3, // Increased chance to find enemies
  ENEMY_BASE_HEALTH: 10,
  ENEMY_HEALTH_PER_LEVEL: 5,
  ENEMY_DIAMOND_REWARD_MULTIPLIER: 10,
  ENEMY_DIAMOND_REWARD_BASE_MULTIPLIER: 5,
  ENEMY_XP_REWARD_MULTIPLIER: 25,
  PLAYER_ENEMY_ATTACK_MULTIPLIER: 2,
  ENEMY_ATTACK_INTERVAL: 3000,
  ENEMY_BASE_DAMAGE: 3,
  ENEMY_DAMAGE_PER_LEVEL: 1,
  // New Enemy Config
  LURKER_DODGE_CHANCE: 0.25,
  ELEMENTAL_SPECIAL_CHANCE: 0.2,
  ELEMENTAL_SPECIAL_MULTIPLIER: 1.5, // 50% more damage
  // PvP Arena
  PLAYER_ARENA_ATTACK_BASE: 2,
  PLAYER_ARENA_ATTACK_MULTIPLIER: 4,
  OPPONENT_ATTACK_BASE_MULTIPLIER: 1.5,
  OPPONENT_ATTACK_MULTIPLIER: 3,
  OPPONENT_POWER_ATTACK_MULTIPLIER: 1.5,
  OPPONENT_BASE_HEALTH: 80,
  OPPONENT_HEALTH_PER_LEVEL: 20,
  ARENA_XP_REWARD_MULTIPLIER: 15,
  ARENA_DIAMOND_REWARD_MULTIPLIER: 10,
  PVP_HEAL_COST: 25,
  PVP_HEAL_PERCENT: 0.4,
  PVP_BLOCK_DAMAGE_REDUCTION: 0.75, // Block 75% of damage
  // Wise Crystal
  CRYSTAL_BASE_COST: 20,
  CRYSTAL_COST_PER_LEVEL: 5,
  API_COOLDOWN_MS: 60000, // 60 seconds
};

// --- GAME STATE MANAGEMENT ---

function getInitialGameState() {
  return {
    name: 'Hero',
    level: 1,
    xp: 0,
    xpToNextLevel: GAME_CONFIG.XP_TO_LEVEL_1,
    diamonds: 0,
    portalMinBonus: 0,
    portalMaxBonus: 0,
    inCombat: false,
    playerHealth: GAME_CONFIG.PLAYER_BASE_HEALTH,
    playerMaxHealth: GAME_CONFIG.PLAYER_BASE_HEALTH,
    lastLoginDate: null,
    streak: 0,
    golemAttackBonus: 0,
    xpBonusMultiplier: 1,
    activeBuffs: {},
    damageReduction: 0,
    arenaHealBonus: 0,
    enemyDiamondDoubleChance: 0,
  };
}

let gameState = getInitialGameState();

let shopItems = [
  {
    id: 'crystal_magnet',
    name: 'Crystal Magnet',
    description: 'Increases minimum diamonds from portals by 2.',
    cost: 50,
    isPurchased: false,
    applyEffect: (state) => {
      state.portalMinBonus += 2;
    },
  },
  {
    id: 'explorers_charm',
    name: "Explorer's Charm",
    description: 'Increases maximum diamonds from portals by 5.',
    cost: 100,
    isPurchased: false,
    applyEffect: (state) => {
      state.portalMaxBonus += 5;
    },
  },
  {
    id: 'golem_heart',
    name: "Golem's Heart",
    description: 'Permanently increases your attack against Crystal Golems.',
    cost: 150,
    isPurchased: false,
    applyEffect: (state) => {
      state.golemAttackBonus += 3;
    },
  },
  {
    id: 'scroll_of_wisdom',
    name: 'Scroll of Wisdom',
    description: 'Permanently increases all XP gains by 10%.',
    cost: 250,
    isPurchased: false,
    applyEffect: (state) => {
      state.xpBonusMultiplier += 0.1;
    },
  },
  {
    id: 'aegis_of_valor',
    name: 'Aegis of Valor',
    description: 'Permanently reduces all damage taken by 5%.',
    cost: 300,
    isPurchased: false,
    applyEffect: (state) => {
      state.damageReduction += 0.05;
    },
  },
  {
    id: 'ring_of_regeneration',
    name: 'Ring of Regeneration',
    description: 'Increases the effectiveness of your Heal in the Arena.',
    cost: 200,
    isPurchased: false,
    applyEffect: (state) => {
      state.arenaHealBonus += 0.1; // 10% more healing
    },
  },
  {
    id: 'lucky_doubloon',
    name: 'Lucky Doubloon',
    description: 'Grants a permanent 10% chance to double diamond rewards from enemies.',
    cost: 400,
    isPurchased: false,
    applyEffect: (state) => {
      state.enemyDiamondDoubleChance += 0.1;
    },
  },
  // Consumables
  {
    id: 'potion_xp_boost',
    name: 'Potion of XP Boost',
    description: 'Doubles XP gain for the next 5 portal discoveries.',
    cost: 75,
    isPurchased: false,
    isConsumable: true,
    applyEffect: (state) => {
        state.activeBuffs['xp_boost'] = { duration: 5, description: "2x XP" };
    },
  },
];


let enemy = {
  name: '',
  health: 0,
  maxHealth: 0,
  level: 1,
  type: '',
  attackIntervalId: null,
};

let pvpState = {
    playerHealth: 0,
    playerMaxHealth: 0,
    opponentHealth: 0,
    opponentMaxHealth: 0,
    opponentName: '',
    opponentLevel: 1,
    opponentNextMove: null,
    isPlayerTurn: true,
    isGameOver: false,
    playerAction: null,
};

// Cooldown tracking for API calls
const apiCooldowns = {
    crystal: 0,
    arena: 0,
};

const dailyRewards = [
  { diamonds: 25 },
  { diamonds: 40 },
  { diamonds: 60 },
  { diamonds: 80 },
  { diamonds: 100 },
  { diamonds: 150 },
  { diamonds: 200, bonus: '2x XP for 10 portals' },
];

const elements = {
  // Screens
  loginScreen: document.getElementById('login-screen'),
  gameScreen: document.getElementById('game-screen'),
  // Login
  loginForm: document.getElementById('login-form'),
  // FIX: Cast to HTMLInputElement to access the 'value' property.
  usernameInput: document.getElementById('username-input') as HTMLInputElement,
  continueContainer: document.getElementById('continue-container'),
  continueBtn: document.getElementById('continue-btn'),
  orSeparator: document.getElementById('or-separator'),
  inactivityMessage: document.getElementById('inactivity-message'),
  // Player Stats
  playerName: document.getElementById('player-name'),
  playerLevel: document.getElementById('player-level'),
  playerDiamonds: document.getElementById('player-diamonds'),
  playerHealthText: document.getElementById('player-health-text'),
  healthBarFill: document.getElementById('health-bar-fill'),
  playerXpText: document.getElementById('player-xp-text'),
  xpBarFill: document.getElementById('xp-bar-fill'),
  activeBuffsContainer: document.getElementById('active-buffs-container'),
  // Game World
  portalContainer: document.getElementById('portal-container'),
  portal: document.getElementById('portal'),
  enemyContainer: document.getElementById('enemy-container'),
  enemySprite: document.getElementById('enemy-sprite'),
  enemyName: document.getElementById('enemy-name'),
  enemyHealthBarFill: document.getElementById('enemy-health-bar-fill'),
  // Buttons
  resetBtn: document.getElementById('reset-btn'),
  shopBtn: document.getElementById('shop-btn'),
  crystalBtn: document.getElementById('crystal-btn'),
  arenaBtn: document.getElementById('arena-btn'),
  leaderboardBtn: document.getElementById('leaderboard-btn'),
  // Modals
  shopModal: document.getElementById('shop-modal'),
  closeShopBtn: document.getElementById('close-shop-btn'),
  shopItemsContainer: document.getElementById('shop-items-container'),
  notification: document.getElementById('notification'),
  crystalModal: document.getElementById('crystal-modal'),
  closeCrystalBtn: document.getElementById('close-crystal-btn'),
  crystalForm: document.getElementById('crystal-form'),
  crystalResponseArea: document.getElementById('crystal-response-area'),
  askCrystalBtn: document.getElementById('ask-crystal-btn'),
  dailyRewardModal: document.getElementById('daily-reward-modal'),
  closeDailyRewardBtn: document.getElementById('close-daily-reward-btn'),
  dailyRewardGrid: document.getElementById('daily-reward-grid'),
  dailyRewardText: document.getElementById('daily-reward-text'),
  dailyRewardDay: document.getElementById('daily-reward-day'),
  // FIX: Cast to HTMLButtonElement to access the 'disabled' property.
  claimRewardBtn: document.getElementById('claim-reward-btn') as HTMLButtonElement,
  pvpModal: document.getElementById('pvp-modal'),
  closePvpBtn: document.getElementById('close-pvp-btn'),
  pvpPlayerName: document.getElementById('pvp-player-name'),
  pvpPlayerHealthText: document.getElementById('pvp-player-health-text'),
  pvpPlayerHealthBar: document.getElementById('pvp-player-health-bar'),
  pvpPlayerActionDisplay: document.getElementById('pvp-player-action-display'),
  pvpOpponentName: document.getElementById('pvp-opponent-name'),
  pvpOpponentHealthText: document.getElementById('pvp-opponent-health-text'),
  pvpOpponentHealthBar: document.getElementById('pvp-opponent-health-bar'),
  pvpOpponentTelegraph: document.getElementById('pvp-opponent-telegraph'),
  pvpOpponentNextMove: document.getElementById('pvp-opponent-next-move'),
  pvpLog: document.getElementById('pvp-log'),
  pvpResultText: document.getElementById('pvp-result-text'),
  pvpActions: document.getElementById('pvp-actions'),
  pvpAttackBtn: document.getElementById('pvp-attack-btn'),
  pvpBlockBtn: document.getElementById('pvp-block-btn'),
  // FIX: Cast to HTMLButtonElement to access the 'disabled' property.
  pvpHealBtn: document.getElementById('pvp-heal-btn') as HTMLButtonElement,
  leaderboardModal: document.getElementById('leaderboard-modal'),
  closeLeaderboardBtn: document.getElementById('close-leaderboard-btn'),
  leaderboardList: document.getElementById('leaderboard-list'),
};

// --- SAVE & LOAD ---

function saveGameState() {
  const data = {
    gameState,
    shopItems: shopItems.map(item => ({ id: item.id, isPurchased: item.isPurchased })),
  };
  localStorage.setItem('crystalRealmsSave', JSON.stringify(data));
}

function loadGameState() {
  const savedData = localStorage.getItem('crystalRealmsSave');
  if (savedData) {
    const { gameState: savedGameState, shopItems: savedShopItems } = JSON.parse(savedData);
    
    const lastLogin = savedGameState.lastLoginDate ? new Date(savedGameState.lastLoginDate) : null;
    const now = new Date();
    const twoDays = 1000 * 60 * 60 * 48;

    if (lastLogin && (now.getTime() - lastLogin.getTime()) > twoDays) {
        elements.inactivityMessage.classList.remove('hidden');
        localStorage.removeItem('crystalRealmsSave');
        return false;
    }
      
    gameState = { ...getInitialGameState(), ...savedGameState };
    
    // Recalculate max health on load
    gameState.playerMaxHealth = GAME_CONFIG.PLAYER_BASE_HEALTH + (gameState.level - 1) * GAME_CONFIG.HEALTH_PER_LEVEL;

    if(gameState.playerHealth > gameState.playerMaxHealth) {
        gameState.playerHealth = gameState.playerMaxHealth;
    }

    if (savedShopItems) {
      shopItems.forEach(item => {
        const savedItem = savedShopItems.find(s => s.id === item.id);
        if (savedItem) {
          item.isPurchased = savedItem.isPurchased;
        }
      });
    }
    // Re-apply effects from purchased items
    applyAllPurchasedItemEffects();
    
    return true;
  }
  return false;
}

function resetGame() {
    if (confirm("Are you sure you want to reset your progress? This cannot be undone.")) {
        localStorage.removeItem('crystalRealmsSave');
        gameState = getInitialGameState();
        shopItems.forEach(item => item.isPurchased = false);
        location.reload();
    }
}

// --- UI UPDATES ---

function updateAllUI() {
  updatePlayerStats();
  updateGameWorld();
  updateShop();
  updateActiveBuffs();
}

function updatePlayerStats() {
  elements.playerName.textContent = gameState.name;
  // FIX: Convert number to string for textContent property.
  elements.playerLevel.textContent = String(gameState.level);
  // FIX: Convert number to string for textContent property.
  elements.playerDiamonds.textContent = String(gameState.diamonds);

  const healthPercentage = (gameState.playerHealth / gameState.playerMaxHealth) * 100;
  elements.healthBarFill.style.width = `${healthPercentage}%`;
  elements.playerHealthText.textContent = `${Math.ceil(gameState.playerHealth)} / ${gameState.playerMaxHealth}`;

  const xpPercentage = (gameState.xp / gameState.xpToNextLevel) * 100;
  elements.xpBarFill.style.width = `${xpPercentage}%`;
  elements.playerXpText.textContent = `${gameState.xp} / ${gameState.xpToNextLevel} XP`;
}

function updateGameWorld() {
  if (gameState.inCombat) {
    elements.portalContainer.classList.add('hidden');
    elements.enemyContainer.classList.remove('hidden');
    elements.enemyName.textContent = `${enemy.name} (Lvl ${enemy.level})`;
    const enemyHealthPercentage = (enemy.health / enemy.maxHealth) * 100;
    elements.enemyHealthBarFill.style.width = `${enemyHealthPercentage}%`;
  } else {
    elements.portalContainer.classList.remove('hidden');
    elements.enemyContainer.classList.add('hidden');
  }
}

function showNotification(message, type = 'info') {
  elements.notification.textContent = message;
  elements.notification.style.borderColor =
    type === 'success'
      ? 'var(--glow-color-primary)'
      : type === 'error'
      ? 'var(--health-color)'
      : 'var(--xp-color)';
  elements.notification.classList.remove('hidden');

  setTimeout(() => {
    elements.notification.classList.add('hidden');
  }, 3000);
}

function switchScreen(screenToShow) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  screenToShow.classList.add('active');
}

function updateShop() {
  elements.shopItemsContainer.innerHTML = '';
  shopItems.forEach(item => {
    const itemCard = document.createElement('div');
    itemCard.className = 'item-card';
    itemCard.innerHTML = `
      <div class="item-info">
        <h3 class="${item.isConsumable ? 'consumable' : ''}">${item.name}</h3>
        <p>${item.description}</p>
      </div>
      <div class="item-action">
        <div class="item-cost">
          <i class="fas fa-gem"></i> ${item.cost}
        </div>
        <button id="buy-${item.id}" ${
          (gameState.diamonds < item.cost || (item.isPurchased && !item.isConsumable)) ? 'disabled' : ''
        }>
          ${(item.isPurchased && !item.isConsumable) ? 'Purchased' : 'Buy'}
        </button>
      </div>
    `;
    elements.shopItemsContainer.appendChild(itemCard);

    const buyButton = document.getElementById(`buy-${item.id}`);
    buyButton.addEventListener('click', () => buyItem(item));
  });
}

function updateActiveBuffs() {
    elements.activeBuffsContainer.innerHTML = '';
    for (const buffId in gameState.activeBuffs) {
        const buff = gameState.activeBuffs[buffId];
        const buffElement = document.createElement('div');
        buffElement.className = 'buff-indicator';
        buffElement.innerHTML = `
            <i class="fas fa-magic"></i>
            <span>${buff.description} (${buff.duration} left)</span>
        `;
        elements.activeBuffsContainer.appendChild(buffElement);
    }
}

// --- GAME LOGIC ---

function checkLevelUp() {
  if (gameState.xp >= gameState.xpToNextLevel) {
    gameState.level++;
    gameState.xp -= gameState.xpToNextLevel;
    gameState.xpToNextLevel = Math.floor(
      gameState.xpToNextLevel * GAME_CONFIG.XP_LEVEL_MULTIPLIER
    );
    gameState.playerMaxHealth += GAME_CONFIG.HEALTH_PER_LEVEL;
    gameState.playerHealth = gameState.playerMaxHealth; // Full heal on level up

    const diamondReward = gameState.level * GAME_CONFIG.LEVEL_UP_DIAMOND_REWARD_MULTIPLIER;
    gameState.diamonds += diamondReward;

    showNotification(
      `Level Up! You are now level ${gameState.level}! You received ${diamondReward} diamonds.`,
      'success'
    );
    checkLevelUp(); // In case of multiple level ups
  }
}

function gainXP(amount) {
    let effectiveMultiplier = gameState.xpBonusMultiplier;
    if (gameState.activeBuffs['xp_boost']) {
        effectiveMultiplier *= 2;
    }
    gameState.xp += Math.floor(amount * effectiveMultiplier);
    checkLevelUp();
    updatePlayerStats();
}

function enterPortal() {
  if (gameState.inCombat) return;

  const minDiamonds = GAME_CONFIG.PORTAL_BASE_MIN_DIAMONDS + gameState.portalMinBonus;
  const maxDiamonds = GAME_CONFIG.PORTAL_BASE_MAX_DIAMONDS + gameState.portalMaxBonus;
  const diamondsFound = Math.floor(Math.random() * (maxDiamonds - minDiamonds + 1)) + minDiamonds;
  gameState.diamonds += diamondsFound;
  gainXP(GAME_CONFIG.PORTAL_XP_REWARD);
  
  showNotification(
    `You found ${diamondsFound} diamonds and gained ${GAME_CONFIG.PORTAL_XP_REWARD} XP!`,
    'info'
  );

  if (gameState.activeBuffs['xp_boost']) {
    gameState.activeBuffs['xp_boost'].duration--;
    if (gameState.activeBuffs['xp_boost'].duration <= 0) {
        delete gameState.activeBuffs['xp_boost'];
        showNotification('Your XP Boost has worn off.', 'warning');
    }
    updateActiveBuffs();
  }

  updatePlayerStats();
  saveGameState();

  if (Math.random() < GAME_CONFIG.COMBAT_CHANCE) {
    startCombat();
  }
}

function startCombat() {
  gameState.inCombat = true;
  const enemyTypes = [
    { type: 'golem', name: 'Crystal Golem', style: 'golem'},
    { type: 'lurker', name: 'Shadow Lurker', style: 'lurker'},
    { type: 'elemental', name: 'Crystal Elemental', style: 'elemental'},
  ];
  const chosenEnemy = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

  enemy.level = Math.max(1, gameState.level + Math.floor(Math.random() * 3) - 1);
  enemy.maxHealth = GAME_CONFIG.ENEMY_BASE_HEALTH + (enemy.level - 1) * GAME_CONFIG.ENEMY_HEALTH_PER_LEVEL;
  enemy.health = enemy.maxHealth;
  enemy.name = chosenEnemy.name;
  enemy.type = chosenEnemy.type;
  
  elements.enemySprite.className = ''; // Reset classes
  elements.enemySprite.classList.add(chosenEnemy.style);

  showNotification(`A wild ${enemy.name} (Lvl ${enemy.level}) appears!`, 'warning');
  updateGameWorld();

  enemy.attackIntervalId = setInterval(enemyAttack, GAME_CONFIG.ENEMY_ATTACK_INTERVAL);
}

function endCombat() {
    gameState.inCombat = false;
    clearInterval(enemy.attackIntervalId);
    enemy.attackIntervalId = null;
    updateGameWorld();
    saveGameState();
}

function attackEnemy() {
  if (!gameState.inCombat) return;

  // Lurker Dodge Mechanic
  if (enemy.type === 'lurker' && Math.random() < GAME_CONFIG.LURKER_DODGE_CHANCE) {
      showNotification(`${enemy.name} dodged your attack!`, 'info');
      return;
  }

  let damage = (gameState.level * GAME_CONFIG.PLAYER_ENEMY_ATTACK_MULTIPLIER) + Math.floor(Math.random() * 5);
  // Golem specific bonus
  if (enemy.type === 'golem') {
      damage += gameState.golemAttackBonus;
  }

  enemy.health -= damage;

  // Animate hit
  elements.enemySprite.classList.add('hit');
  setTimeout(() => elements.enemySprite.classList.remove('hit'), 300);

  if (enemy.health <= 0) {
    // Enemy defeated
    let diamondReward = (enemy.level * GAME_CONFIG.ENEMY_DIAMOND_REWARD_MULTIPLIER) + 
                       Math.floor(Math.random() * (enemy.level * GAME_CONFIG.ENEMY_DIAMOND_REWARD_BASE_MULTIPLIER));

    // Lucky Doubloon Check
    if(Math.random() < gameState.enemyDiamondDoubleChance) {
        diamondReward *= 2;
        showNotification('Lucky Doubloon activates! Double diamonds!', 'success');
    }

    const xpReward = enemy.level * GAME_CONFIG.ENEMY_XP_REWARD_MULTIPLIER;
    gameState.diamonds += diamondReward;
    gainXP(xpReward);
    showNotification(
      `You defeated the ${enemy.name}! Gained ${diamondReward} diamonds and ${xpReward} XP.`,
      'success'
    );
    endCombat();
  }
  updateGameWorld();
}

function enemyAttack() {
    if (!gameState.inCombat || enemy.health <= 0) return;

    let damage = GAME_CONFIG.ENEMY_BASE_DAMAGE + (enemy.level - 1) * GAME_CONFIG.ENEMY_DAMAGE_PER_LEVEL;

    // Elemental Special Attack
    if (enemy.type === 'elemental' && Math.random() < GAME_CONFIG.ELEMENTAL_SPECIAL_CHANCE) {
        damage *= GAME_CONFIG.ELEMENTAL_SPECIAL_MULTIPLIER;
        showNotification(`${enemy.name} unleashes a powerful crystal spike!`, 'error');
        elements.healthBarFill.parentElement.classList.add('burning');
        setTimeout(() => elements.healthBarFill.parentElement.classList.remove('burning'), 1000);
    }
    
    // Apply player damage reduction
    damage *= (1 - gameState.damageReduction);
    damage = Math.max(1, Math.floor(damage)); // Always do at least 1 damage

    gameState.playerHealth -= damage;
    showNotification(`${enemy.name} attacks you for ${damage} damage!`, 'error');

    if (gameState.playerHealth <= 0) {
        gameState.playerHealth = 0;
        showNotification(`You have been defeated! You lost half your diamonds.`, 'error');
        gameState.diamonds = Math.floor(gameState.diamonds / 2);
        // Respawn with a fraction of health
        gameState.playerHealth = Math.floor(gameState.playerMaxHealth * 0.25);
        endCombat();
    }
    updatePlayerStats();
}

function applyAllPurchasedItemEffects() {
  // Reset all bonuses to avoid stacking on load
  gameState.portalMinBonus = getInitialGameState().portalMinBonus;
  gameState.portalMaxBonus = getInitialGameState().portalMaxBonus;
  gameState.golemAttackBonus = getInitialGameState().golemAttackBonus;
  gameState.xpBonusMultiplier = getInitialGameState().xpBonusMultiplier;
  gameState.damageReduction = getInitialGameState().damageReduction;
  gameState.arenaHealBonus = getInitialGameState().arenaHealBonus;
  gameState.enemyDiamondDoubleChance = getInitialGameState().enemyDiamondDoubleChance;
  // Apply effects
  shopItems.forEach(item => {
    if (item.isPurchased && !item.isConsumable) {
      item.applyEffect(gameState);
    }
  });
}

function buyItem(item) {
  if (gameState.diamonds >= item.cost) {
    if (!item.isPurchased || item.isConsumable) {
      gameState.diamonds -= item.cost;
      if (!item.isConsumable) {
        item.isPurchased = true;
      }
      item.applyEffect(gameState);
      showNotification(`You purchased ${item.name}!`, 'success');
      updateAllUI();
      saveGameState();
    }
  } else {
    showNotification("You don't have enough diamonds!", 'error');
  }
}

function checkDailyReward() {
  const today = new Date().toISOString().split('T')[0];
  if (gameState.lastLoginDate !== today) {
    if (gameState.lastLoginDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (yesterday.toISOString().split('T')[0] === gameState.lastLoginDate) {
            gameState.streak++;
        } else {
            gameState.streak = 1;
        }
    } else {
        gameState.streak = 1;
    }
    openDailyRewardModal();
  }
}

// --- MODAL LOGIC ---
function openModal(modal) {
    modal.classList.remove('hidden');
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

// Leaderboard
async function openLeaderboardModal() {
    openModal(elements.leaderboardModal);
    elements.leaderboardList.innerHTML = '<div class="loading-spinner"></div>';
    
    // This is a mock leaderboard. In a real app, this would fetch from a server.
    const mockLeaderboard = [
        { name: 'Zephyr', level: gameState.level + 5 },
        { name: 'Luna', level: gameState.level + 3 },
        { name: 'Crimson', level: gameState.level + 2 },
        { name: 'Solaris', level: gameState.level + 1 },
        { name: gameState.name, level: gameState.level, isPlayer: true },
        { name: 'Nyx', level: Math.max(1, gameState.level - 1) },
        { name: 'Rook', level: Math.max(1, gameState.level - 2) },
    ].sort((a,b) => b.level - a.level);

    setTimeout(() => {
        elements.leaderboardList.innerHTML = '';
        mockLeaderboard.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            if (player.isPlayer) {
                item.classList.add('player');
            }
            item.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${player.name}</span>
                <span class="level">Level ${player.level}</span>
            `;
            elements.leaderboardList.appendChild(item);
        });
    }, 500);
}

// Daily Reward
function openDailyRewardModal() {
    const dayIndex = Math.min(gameState.streak - 1, dailyRewards.length - 1);
    // FIX: Convert number to string for textContent property.
    elements.dailyRewardDay.textContent = String(gameState.streak);
    elements.dailyRewardGrid.innerHTML = '';
    dailyRewards.forEach((reward, index) => {
        const card = document.createElement('div');
        card.className = 'reward-card';
        if (index < dayIndex) card.classList.add('claimed');
        if (index === dayIndex) card.classList.add('current');
        card.innerHTML = `
            <div class="reward-card-day">Day ${index + 1}</div>
            <div class="reward-card-reward"><i class="fas fa-gem"></i> ${reward.diamonds}</div>
            ${reward.bonus ? `<div class="reward-bonus">${reward.bonus}</div>` : ''}
        `;
        elements.dailyRewardGrid.appendChild(card);
    });
    elements.claimRewardBtn.disabled = false;
    openModal(elements.dailyRewardModal);
}

function claimDailyReward() {
    const dayIndex = Math.min(gameState.streak - 1, dailyRewards.length - 1);
    const reward = dailyRewards[dayIndex];
    gameState.diamonds += reward.diamonds;
    showNotification(`You claimed ${reward.diamonds} diamonds!`, 'success');

    if (reward.bonus && reward.bonus.includes('XP')) {
        gameState.activeBuffs['xp_boost'] = { duration: 10, description: "2x XP" };
        showNotification(`You received an XP Boost!`, 'success');
    }

    gameState.lastLoginDate = new Date().toISOString().split('T')[0];
    elements.claimRewardBtn.disabled = true;
    saveGameState();
    updateAllUI();
    closeModal(elements.dailyRewardModal);
}


// --- API-DEPENDENT FEATURES ---

function setApiCooldown(api, button) {
  apiCooldowns[api] = Date.now() + GAME_CONFIG.API_COOLDOWN_MS;
  button.classList.add('api-cooldown');
  button.disabled = true;

  const interval = setInterval(() => {
    const timeLeft = Math.ceil((apiCooldowns[api] - Date.now()) / 1000);
    if (timeLeft > 0) {
      button.querySelector('i').className = 'fas fa-hourglass-half';
    } else {
      button.classList.remove('api-cooldown');
      button.disabled = false;
      // Restore icon - needs specific implementation per button
      if (button.id === 'ask-crystal-btn') button.querySelector('i').className = 'fas fa-magic';
      if (button.id === 'arena-btn') button.querySelector('i').className = 'fas fa-shield-halved';
      clearInterval(interval);
    }
  }, 1000);
}

// Wise Crystal
async function handleCrystalQuery(event) {
    event.preventDefault();
    const ready = await initializeAi();
    if (!ready) return;

    // FIX: Cast to HTMLInputElement to access the 'value' property.
    const questionInput = document.getElementById('crystal-question-input') as HTMLInputElement;
    const question = questionInput.value.trim();
    if (!question) return;

    const cost = GAME_CONFIG.CRYSTAL_BASE_COST + gameState.level * GAME_CONFIG.CRYSTAL_COST_PER_LEVEL;
    if (gameState.diamonds < cost) {
        showNotification(`You need ${cost} diamonds to ask the crystal.`, 'error');
        return;
    }

    gameState.diamonds -= cost;
    updatePlayerStats();
    saveGameState();
    setApiCooldown('crystal', elements.askCrystalBtn);
    
    elements.crystalResponseArea.innerHTML = '<div class="loading-spinner"></div>';
    questionInput.value = '';

    try {
        const systemInstruction = `You are a wise, ancient crystal in a fantasy game called Crystal Realms. 
        Your name is Oracle. Players ask you for advice, lore, or creative ideas related to the game.
        Respond concisely (2-3 sentences), mystically, and enigmatically.
        The player's name is ${gameState.name} and they are level ${gameState.level}.
        Never break character. Do not mention you are an AI.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: question,
            config: { systemInstruction: systemInstruction }
        });

        elements.crystalResponseArea.innerHTML = `<p>${response.text}</p>`;
    } catch (error) {
        console.error('Gemini API Error:', error);
        elements.crystalResponseArea.innerHTML =
        '<p class="crystal-greeting" style="color: var(--health-color);">The crystal flickers and goes dark... An error occurred.</p>';
        gameState.diamonds += cost; // Refund on error
        updatePlayerStats();
    }
}

// PvP Arena
async function openArenaModal() {
    const ready = await initializeAi();
    if (!ready) return;

    if (apiCooldowns.arena > Date.now()) {
        showNotification(`You are too weary to enter the arena. Try again in ${Math.ceil((apiCooldowns.arena - Date.now()) / 1000)}s.`, 'warning');
        return;
    }
    
    openModal(elements.pvpModal);
    elements.pvpResultText.classList.add('hidden');
    elements.pvpLog.innerHTML = '<p class="system-message">Generating a worthy opponent...</p>';
    elements.pvpActions.style.display = 'none';

    try {
        const systemInstruction = `You are an AI that creates a fantasy RPG opponent for a player vs. AI arena battle.
        The player is named ${gameState.name} and is level ${gameState.level}.
        Generate a creative, thematic opponent name and a short, descriptive title (e.g., "The Crystal-forged Golem" or "The Shadow Serpent").
        The opponent's level should be close to the player's level.
        The opponent's name should be unique and interesting.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Generate a new opponent.",
            config: { 
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING" },
                        title: { type: "STRING" },
                        level: { type: "INTEGER" }
                    }
                }
            }
        });
        
        const opponentData = JSON.parse(response.text);
        
        pvpState.opponentName = `${opponentData.name}, ${opponentData.title}`;
        pvpState.opponentLevel = Math.max(1, opponentData.level);

    } catch (error) {
        console.error("Failed to generate AI opponent:", error);
        showNotification("Could not find an opponent. Using a training golem.", 'warning');
        pvpState.opponentName = "Training Golem";
        pvpState.opponentLevel = gameState.level;
    } finally {
        startPvpMatch();
    }
}

function startPvpMatch() {
    pvpState.playerMaxHealth = gameState.playerMaxHealth;
    pvpState.playerHealth = gameState.playerHealth;
    pvpState.opponentMaxHealth = GAME_CONFIG.OPPONENT_BASE_HEALTH + (pvpState.opponentLevel - 1) * GAME_CONFIG.OPPONENT_HEALTH_PER_LEVEL;
    pvpState.opponentHealth = pvpState.opponentMaxHealth;
    pvpState.isGameOver = false;
    pvpState.isPlayerTurn = true;

    elements.pvpLog.innerHTML = '';
    elements.pvpActions.style.display = 'flex';
    elements.pvpResultText.classList.add('hidden');
    elements.pvpHealBtn.disabled = false;
    elements.pvpHealBtn.innerHTML = `<i class="fas fa-heart"></i> Heal (<i class="fas fa-gem"></i>${GAME_CONFIG.PVP_HEAL_COST})`;

    updatePvpUI();
    addPvpLogMessage(`${gameState.name} enters the arena against ${pvpState.opponentName}!`, 'system');
    telegraphOpponentMove();
}

function updatePvpUI() {
    // Player
    elements.pvpPlayerName.textContent = gameState.name;
    let playerHealthPercent = (pvpState.playerHealth / pvpState.playerMaxHealth) * 100;
    elements.pvpPlayerHealthBar.style.width = `${playerHealthPercent}%`;
    elements.pvpPlayerHealthText.textContent = `${Math.ceil(pvpState.playerHealth)}/${pvpState.playerMaxHealth}`;
    
    // Opponent
    elements.pvpOpponentName.textContent = pvpState.opponentName;
    let opponentHealthPercent = (pvpState.opponentHealth / pvpState.opponentMaxHealth) * 100;
    elements.pvpOpponentHealthBar.style.width = `${opponentHealthPercent}%`;
    elements.pvpOpponentHealthText.textContent = `${Math.ceil(pvpState.opponentHealth)}/${pvpState.opponentMaxHealth}`;

    elements.pvpOpponentTelegraph.style.visibility = pvpState.isGameOver ? 'hidden' : 'visible';
    elements.pvpPlayerActionDisplay.textContent = pvpState.playerAction ? `You chose: ${pvpState.playerAction}` : '';
}

function addPvpLogMessage(message, type) {
    const logEntry = document.createElement('p');
    logEntry.className = type;
    logEntry.textContent = message;
    elements.pvpLog.prepend(logEntry);
}

function telegraphOpponentMove() {
    const moves = ['Attack', 'Attack', 'Power Attack', 'Block'];
    pvpState.opponentNextMove = moves[Math.floor(Math.random() * moves.length)];
    elements.pvpOpponentNextMove.textContent = pvpState.opponentNextMove;
}

function handlePvpAction(action) {
    if (!pvpState.isPlayerTurn || pvpState.isGameOver) return;
    pvpState.isPlayerTurn = false;
    pvpState.playerAction = action;

    if (action === 'Heal') {
        if (gameState.diamonds < GAME_CONFIG.PVP_HEAL_COST) {
            addPvpLogMessage(`Not enough diamonds to heal!`, 'system-error');
            pvpState.isPlayerTurn = true;
            return;
        }
        gameState.diamonds -= GAME_CONFIG.PVP_HEAL_COST;
        const healAmount = pvpState.playerMaxHealth * (GAME_CONFIG.PVP_HEAL_PERCENT + gameState.arenaHealBonus);
        pvpState.playerHealth = Math.min(pvpState.playerMaxHealth, pvpState.playerHealth + healAmount);
        addPvpLogMessage(`${gameState.name} heals for ${Math.floor(healAmount)} health.`, 'player-action');
        elements.pvpHealBtn.disabled = true; // One heal per match
        elements.pvpHealBtn.innerHTML = '<i class="fas fa-heart"></i> Used';
        updatePlayerStats();
    }
    
    updatePvpUI();

    setTimeout(resolvePvpTurn, 1000);
}

function resolvePvpTurn() {
    const opponentAction = pvpState.opponentNextMove;
    let playerDamage = 0;
    let opponentDamage = 0;

    // Calculate Player Damage
    if (pvpState.playerAction === 'Attack') {
        playerDamage = GAME_CONFIG.PLAYER_ARENA_ATTACK_BASE + gameState.level * GAME_CONFIG.PLAYER_ARENA_ATTACK_MULTIPLIER + Math.floor(Math.random() * 5);
        if (opponentAction === 'Block') {
            playerDamage *= (1 - GAME_CONFIG.PVP_BLOCK_DAMAGE_REDUCTION);
            addPvpLogMessage(`${pvpState.opponentName} blocks most of the damage!`, 'system');
        }
    }

    // Calculate Opponent Damage
    if (opponentAction === 'Attack' || opponentAction === 'Power Attack') {
        let baseDamage = pvpState.opponentLevel * GAME_CONFIG.OPPONENT_ATTACK_MULTIPLIER;
        if (opponentAction === 'Power Attack') {
            baseDamage *= GAME_CONFIG.OPPONENT_POWER_ATTACK_MULTIPLIER;
        }
        opponentDamage = baseDamage + Math.floor(Math.random() * (pvpState.opponentLevel * GAME_CONFIG.OPPONENT_ATTACK_BASE_MULTIPLIER));
        
        if (pvpState.playerAction === 'Block') {
            opponentDamage *= (1 - GAME_CONFIG.PVP_BLOCK_DAMAGE_REDUCTION);
            addPvpLogMessage(`${gameState.name} blocks most of the damage!`, 'system');
        }
    }
    
    // Apply Damage
    if (playerDamage > 0) {
        playerDamage = Math.floor(playerDamage);
        pvpState.opponentHealth -= playerDamage;
        addPvpLogMessage(`${gameState.name} attacks for ${playerDamage} damage.`, 'player-action');
    }
    if (opponentDamage > 0) {
        opponentDamage = Math.floor(opponentDamage);
        pvpState.playerHealth -= opponentDamage;
        addPvpLogMessage(`${pvpState.opponentName} attacks for ${opponentDamage} damage.`, 'opponent-action');
    }

    if (pvpState.playerAction !== 'Heal' && playerDamage === 0 && opponentDamage === 0) {
        addPvpLogMessage('Both combatants stand their ground, no damage dealt.', 'system');
    }

    pvpState.playerHealth = Math.max(0, pvpState.playerHealth);
    pvpState.opponentHealth = Math.max(0, pvpState.opponentHealth);
    updatePvpUI();

    checkPvpEnd();
}

function checkPvpEnd() {
    if (pvpState.opponentHealth <= 0) {
        endPvpMatch(true);
    } else if (pvpState.playerHealth <= 0) {
        endPvpMatch(false);
    } else {
        // Next turn
        pvpState.isPlayerTurn = true;
        pvpState.playerAction = null;
        telegraphOpponentMove();
        updatePvpUI();
    }
}

function endPvpMatch(playerWon) {
    pvpState.isGameOver = true;
    elements.pvpActions.style.display = 'none';
    elements.pvpResultText.classList.remove('hidden', 'victory', 'defeat');
    
    if (playerWon) {
        const xpReward = pvpState.opponentLevel * GAME_CONFIG.ARENA_XP_REWARD_MULTIPLIER;
        const diamondReward = pvpState.opponentLevel * GAME_CONFIG.ARENA_DIAMOND_REWARD_MULTIPLIER;
        gainXP(xpReward);
        gameState.diamonds += diamondReward;
        elements.pvpResultText.textContent = `VICTORY! (+${xpReward} XP, +${diamondReward} Diamonds)`;
        elements.pvpResultText.classList.add('victory');
        addPvpLogMessage(`${gameState.name} is victorious!`, 'system-message');
    } else {
        elements.pvpResultText.textContent = 'DEFEAT';
        elements.pvpResultText.classList.add('defeat');
        addPvpLogMessage(`${gameState.name} has been defeated.`, 'system-message');
        gameState.playerHealth = 1; // Leave player with 1 HP
    }
    setApiCooldown('arena', elements.arenaBtn);
    updatePlayerStats();
    saveGameState();
}


// --- INITIALIZATION ---

function initGame() {
  const hasSave = loadGameState();

  if (hasSave) {
    switchScreen(elements.gameScreen);
    elements.continueContainer.classList.remove('hidden');
    elements.orSeparator.classList.remove('hidden');
    elements.continueBtn.textContent = `Continue as ${gameState.name} (Lvl ${gameState.level})`;
    updateAllUI();
    checkDailyReward();
  } else {
    switchScreen(elements.loginScreen);
  }

  // Event Listeners
  elements.loginForm.addEventListener('submit', event => {
    event.preventDefault();
    gameState.name = elements.usernameInput.value.trim();
    if (gameState.name) {
      gameState.lastLoginDate = new Date().toISOString().split('T')[0];
      saveGameState();
      updateAllUI();
      switchScreen(elements.gameScreen);
    }
  });

  elements.continueBtn.addEventListener('click', () => {
    switchScreen(elements.gameScreen);
    updateAllUI();
    checkDailyReward();
  });

  elements.portal.addEventListener('click', enterPortal);
  elements.enemySprite.addEventListener('click', attackEnemy);
  elements.resetBtn.addEventListener('click', resetGame);
  
  // Modals
  elements.shopBtn.addEventListener('click', () => openModal(elements.shopModal));
  elements.closeShopBtn.addEventListener('click', () => closeModal(elements.shopModal));
  elements.leaderboardBtn.addEventListener('click', openLeaderboardModal);
  elements.closeLeaderboardBtn.addEventListener('click', () => closeModal(elements.leaderboardModal));
  elements.crystalBtn.addEventListener('click', () => openModal(elements.crystalModal));
  elements.closeCrystalBtn.addEventListener('click', () => closeModal(elements.crystalModal));
  elements.crystalForm.addEventListener('submit', handleCrystalQuery);
  elements.claimRewardBtn.addEventListener('click', claimDailyReward);
  elements.closeDailyRewardBtn.addEventListener('click', () => closeModal(elements.dailyRewardModal));
  elements.arenaBtn.addEventListener('click', openArenaModal);
  elements.closePvpBtn.addEventListener('click', () => {
      // If combat is over, update player HP to match arena outcome.
      if (pvpState.isGameOver) {
          gameState.playerHealth = pvpState.playerHealth > 0 ? pvpState.playerHealth : 1;
          updatePlayerStats();
      }
      closeModal(elements.pvpModal)
  });

  // PvP Actions
  elements.pvpAttackBtn.addEventListener('click', () => handlePvpAction('Attack'));
  elements.pvpBlockBtn.addEventListener('click', () => handlePvpAction('Block'));
  elements.pvpHealBtn.addEventListener('click', () => handlePvpAction('Heal'));

}

// Start the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initGame);
