'use client';

import { useEffect, useRef } from 'react';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Basic game setup
    const gameWidth = 800;
    const gameHeight = 600;

    canvas.width = gameWidth;
    canvas.height = gameHeight;

    // Game variables
    let player = {
      x: 50,
      y: 500,
      width: 30,
      height: 30,
      vx: 0,
      vy: 0,
      onGround: false,
      color: '#FF6B6B'
    };

    let keys = {
      left: false,
      right: false,
      up: false
    };

    const gravity = 0.5;
    const jumpStrength = -12;
    const speed = 5;

    // Platforms
    const platforms = [
      { x: 0, y: 550, width: 200, height: 50, name: 'Cliff', color: '#4ECDC4' },
      { x: 250, y: 500, width: 200, height: 50, name: 'Valley', color: '#45B7D1' },
      { x: 500, y: 450, width: 200, height: 50, name: 'Waterfall', color: '#96CEB4' },
      // Add more platforms for zones
      { x: 700, y: 400, width: 100, height: 50, name: 'Coral', color: '#FFEAA7' },
      { x: 900, y: 350, width: 150, height: 50, name: 'Forest', color: '#DDA0DD' },
      { x: 1100, y: 300, width: 200, height: 50, name: 'Glacier', color: '#87CEEB' }
    ];

    // Obstacles
    const obstacles = [
      { x: 300, y: 475, width: 20, height: 25, type: 'barrel', color: '#8B4513' },
      { x: 600, y: 425, width: 30, height: 25, type: 'garbage', color: '#696969' }
    ];

    // Collectibles
    const collectibles = [
      { x: 350, y: 470, width: 20, height: 20, type: 'wind', collected: false },
      { x: 650, y: 420, width: 20, height: 20, type: 'sun', collected: false }
    ];

    // Interactive elements
    const interactives = [
      { x: 200, y: 520, width: 40, height: 30, type: 'sign', level: 1 },
      { x: 750, y: 370, width: 40, height: 30, type: 'sign', level: 2 },
      { x: 1200, y: 270, width: 40, height: 30, type: 'sign', level: 3 }
    ];

    let cameraX = 0;

    function update() {
      // Player movement
      if (keys.left) player.vx = -speed;
      else if (keys.right) player.vx = speed;
      else player.vx = 0;

      if (keys.up && player.onGround) {
        player.vy = jumpStrength;
        player.onGround = false;
      }

      // Apply gravity
      player.vy += gravity;

      // Update position
      player.x += player.vx;
      player.y += player.vy;

      // Collision with platforms
      player.onGround = false;
      for (const platform of platforms) {
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y < platform.y + platform.height &&
            player.y + player.height > platform.y) {
          if (player.vy > 0 && player.y < platform.y) {
            player.y = platform.y - player.height;
            player.vy = 0;
            player.onGround = true;
          }
        }
      }

      // Camera follow
      cameraX = player.x - gameWidth / 2;

      // Check interactions
      for (const interactive of interactives) {
        if (player.x < interactive.x + interactive.width &&
            player.x + player.width > interactive.x &&
            player.y < interactive.y + interactive.height &&
            player.y + player.height > interactive.y) {
          // Trigger question based on level
          triggerQuestion(interactive.level);
        }
      }

      // Check collectibles
      collectibles.forEach((col, index) => {
        if (!col.collected &&
            player.x < col.x + col.width &&
            player.x + player.width > col.x &&
            player.y < col.y + col.height &&
            player.y + player.height > col.y) {
          col.collected = true;
          console.log(`Collected ${col.type} energy!`);
        }
      });

      // Win condition
      if (collectibles.every(col => col.collected) && player.x > 1400) {
        alert('You win! You collected all renewable energy and reached the finish!');
      }
    }

    function draw() {
      ctx.clearRect(0, 0, gameWidth, gameHeight);

      // Draw zones background
      if (cameraX < 400) {
        ctx.fillStyle = '#00CED1'; // Coral reef
        ctx.fillRect(0, 0, gameWidth, gameHeight);
      } else if (cameraX < 800) {
        ctx.fillStyle = '#228B22'; // Tropical rainforest
        ctx.fillRect(0, 0, gameWidth, gameHeight);
      } else {
        ctx.fillStyle = '#ADD8E6'; // Arctic glacier
        ctx.fillRect(0, 0, gameWidth, gameHeight);
      }

      ctx.save();
      ctx.translate(-cameraX, 0);

      // Draw platforms
      platforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.fillText(platform.name, platform.x + 5, platform.y + 20);
      });

      // Draw obstacles
      obstacles.forEach(obstacle => {
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      });

      // Draw collectibles
      collectibles.forEach(col => {
        if (!col.collected) {
          ctx.fillStyle = col.type === 'wind' ? '#00FF00' : '#FFFF00';
          ctx.fillRect(col.x, col.y, col.width, col.height);
        }
      });

      // Draw interactives
      interactives.forEach(int => {
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(int.x, int.y, int.width, int.height);
      });

      // Draw player
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, player.width, player.height);

      ctx.restore();
    }

    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }

    function triggerQuestion(level: number) {
      let verb = '';
      let correct = '';
      if (level === 1) {
        verb = 'sink';
        correct = 'sunk';
      } else if (level === 2) {
        verb = 'grow';
        correct = 'grown';
      } else if (level === 3) {
        verb = 'freeze';
        correct = 'frozen';
      }

      const answer = prompt(`What is the past participle of '${verb}'?`);
      if (answer?.toLowerCase() === correct) {
        alert('Correct!');
      } else {
        alert(`Incorrect. The correct answer is '${correct}'.`);
      }
    }

    // Event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowRight') keys.right = true;
      if (e.key === 'ArrowUp') keys.up = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'ArrowRight') keys.right = false;
      if (e.key === 'ArrowUp') keys.up = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <canvas ref={canvasRef} className="border border-gray-300" />
    </div>
  );
}