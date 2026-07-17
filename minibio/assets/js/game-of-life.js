(() => {
  const canvas = document.getElementById("game-of-life");

  if (!canvas) return;

  const context = canvas.getContext("2d");

  const cellSize = 20;

  const normalStepInterval = 90;
  const attractedStepInterval = 22;

  let columns = 0;
  let rows = 0;

  let maze = [];
  let solverStack = [];

  let visited = new Set();
  let redTrail = new Set();

  let cursor = {
    x: 0,
    y: 0
  };

  let exit = {
    x: 0,
    y: 0
  };

  let mouseInside = false;
  let mouseX = 0;
  let mouseY = 0;

  let lastStepTime = 0;
  let animationFrame = null;
  let finished = false;

  const directions = [
    {
      dx: 0,
      dy: -1,
      wall: "top",
      opposite: "bottom"
    },
    {
      dx: 1,
      dy: 0,
      wall: "right",
      opposite: "left"
    },
    {
      dx: 0,
      dy: 1,
      wall: "bottom",
      opposite: "top"
    },
    {
      dx: -1,
      dy: 0,
      wall: "left",
      opposite: "right"
    }
  ];

  function createCell(x, y) {
    return {
      x,
      y,
      visited: false,

      walls: {
        top: true,
        right: true,
        bottom: true,
        left: true
      }
    };
  }

  function createMazeGrid() {
    maze = Array.from(
      { length: rows },
      (_, y) =>
        Array.from(
          { length: columns },
          (_, x) => createCell(x, y)
        )
    );
  }

  function resizeCanvas() {
    const bounds =
      canvas.getBoundingClientRect();

    const dpr =
      window.devicePixelRatio || 1;

    canvas.width = Math.max(
      1,
      Math.floor(bounds.width * dpr)
    );

    canvas.height = Math.max(
      1,
      Math.floor(bounds.height * dpr)
    );

    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    columns = Math.max(
      5,
      Math.floor(bounds.width / cellSize)
    );

    rows = Math.max(
      5,
      Math.floor(bounds.height / cellSize)
    );
  }

  function shuffle(array) {
    const result = [...array];

    for (
      let index = result.length - 1;
      index > 0;
      index--
    ) {
      const randomIndex = Math.floor(
        Math.random() * (index + 1)
      );

      [
        result[index],
        result[randomIndex]
      ] = [
        result[randomIndex],
        result[index]
      ];
    }

    return result;
  }

  function generateMaze() {
    createMazeGrid();

    const stack = [];
    const start = maze[0][0];

    start.visited = true;
    stack.push(start);

    while (stack.length > 0) {
      const current =
        stack[stack.length - 1];

      const availableDirections =
        shuffle(directions).filter(
          direction => {
            const nextX =
              current.x + direction.dx;

            const nextY =
              current.y + direction.dy;

            return (
              nextX >= 0 &&
              nextX < columns &&
              nextY >= 0 &&
              nextY < rows &&
              !maze[nextY][nextX].visited
            );
          }
        );

      if (
        availableDirections.length === 0
      ) {
        stack.pop();
        continue;
      }

      const direction =
        availableDirections[0];

      const next =
        maze[
          current.y + direction.dy
        ][
          current.x + direction.dx
        ];

      current.walls[
        direction.wall
      ] = false;

      next.walls[
        direction.opposite
      ] = false;

      next.visited = true;
      stack.push(next);
    }

    maze.forEach(row => {
      row.forEach(cell => {
        cell.visited = false;
      });
    });

    maze[0][0].walls.left = false;

    exit = {
      x: columns - 1,
      y: rows - 1
    };

    maze[exit.y][exit.x]
      .walls.right = false;
  }

  function positionKey(x, y) {
    return `${x},${y}`;
  }

  function resetSolver() {
    cursor = {
      x: 0,
      y: 0
    };

    solverStack = [
      {
        x: cursor.x,
        y: cursor.y
      }
    ];

    visited = new Set([
      positionKey(
        cursor.x,
        cursor.y
      )
    ]);

    redTrail = new Set([
      positionKey(
        cursor.x,
        cursor.y
      )
    ]);

    finished = false;
    lastStepTime = performance.now();
  }

  function getOpenNeighbors(x, y) {
    const cell = maze[y][x];
    const neighbors = [];

    directions.forEach(direction => {
      const nextX =
        x + direction.dx;

      const nextY =
        y + direction.dy;

      if (
        nextX < 0 ||
        nextX >= columns ||
        nextY < 0 ||
        nextY >= rows
      ) {
        return;
      }

      if (!cell.walls[direction.wall]) {
        neighbors.push({
          x: nextX,
          y: nextY
        });
      }
    });

    return neighbors;
  }

  function distanceToMouse(cell) {
    const centerX =
      cell.x * cellSize +
      cellSize / 2;

    const centerY =
      cell.y * cellSize +
      cellSize / 2;

    const differenceX =
      centerX - mouseX;

    const differenceY =
      centerY - mouseY;

    return Math.sqrt(
      differenceX * differenceX +
      differenceY * differenceY
    );
  }

  function chooseNextNeighbor(
    neighbors
  ) {
    if (!mouseInside) {
      return shuffle(neighbors)[0];
    }

    return [...neighbors].sort(
      (first, second) =>
        distanceToMouse(first) -
        distanceToMouse(second)
    )[0];
  }

  function solveStep() {
    if (
      finished ||
      solverStack.length === 0
    ) {
      return;
    }

    const current =
      solverStack[
        solverStack.length - 1
      ];

    cursor = {
      x: current.x,
      y: current.y
    };

    redTrail.add(
      positionKey(
        cursor.x,
        cursor.y
      )
    );

    if (
      cursor.x === exit.x &&
      cursor.y === exit.y
    ) {
      finished = true;
      return;
    }

    const availableNeighbors =
      getOpenNeighbors(
        current.x,
        current.y
      ).filter(neighbor => {
        return !visited.has(
          positionKey(
            neighbor.x,
            neighbor.y
          )
        );
      });

    if (
      availableNeighbors.length > 0
    ) {
      const next =
        chooseNextNeighbor(
          availableNeighbors
        );

      const key =
        positionKey(
          next.x,
          next.y
        );

      visited.add(key);
      redTrail.add(key);
      solverStack.push(next);

      cursor = {
        x: next.x,
        y: next.y
      };

      return;
    }

    solverStack.pop();

    if (solverStack.length > 0) {
      const previous =
        solverStack[
          solverStack.length - 1
        ];

      cursor = {
        x: previous.x,
        y: previous.y
      };

      redTrail.add(
        positionKey(
          cursor.x,
          cursor.y
        )
      );
    }
  }

  function clearCanvas() {
    const bounds =
      canvas.getBoundingClientRect();

    context.fillStyle = "#ffffff";

    context.fillRect(
      0,
      0,
      bounds.width,
      bounds.height
    );
  }

  function drawRedTrail() {
    context.fillStyle =
      "rgba(255, 0, 0, 0.42)";

    redTrail.forEach(key => {
      const [x, y] = key
        .split(",")
        .map(Number);

      context.fillRect(
        x * cellSize + 3,
        y * cellSize + 3,
        cellSize - 6,
        cellSize - 6
      );
    });
  }

  function drawCurrentPath() {
    context.fillStyle =
      "rgba(255, 0, 0, 0.78)";

    solverStack.forEach(cell => {
      context.fillRect(
        cell.x * cellSize + 5,
        cell.y * cellSize + 5,
        cellSize - 10,
        cellSize - 10
      );
    });
  }

  function drawMaze() {
    clearCanvas();
    drawRedTrail();
    drawCurrentPath();

    context.strokeStyle = "#000000";
    context.lineWidth = 2;
    context.lineCap = "square";

    for (let y = 0; y < rows; y++) {
      for (
        let x = 0;
        x < columns;
        x++
      ) {
        const cell = maze[y][x];

        const left =
          x * cellSize;

        const top =
          y * cellSize;

        const right =
          left + cellSize;

        const bottom =
          top + cellSize;

        context.beginPath();

        if (cell.walls.top) {
          context.moveTo(left, top);
          context.lineTo(right, top);
        }

        if (cell.walls.right) {
          context.moveTo(right, top);
          context.lineTo(
            right,
            bottom
          );
        }

        if (cell.walls.bottom) {
          context.moveTo(
            left,
            bottom
          );

          context.lineTo(
            right,
            bottom
          );
        }

        if (cell.walls.left) {
          context.moveTo(left, top);

          context.lineTo(
            left,
            bottom
          );
        }

        context.stroke();
      }
    }

    drawStart();
    drawExit();
    drawCursor();
  }

  function drawStart() {
    context.fillStyle = "#000000";

    context.fillRect(
      3,
      3,
      cellSize - 6,
      cellSize - 6
    );
  }

  function drawExit() {
    context.fillStyle = "#000000";

    context.fillRect(
      exit.x * cellSize + 3,
      exit.y * cellSize + 3,
      cellSize - 6,
      cellSize - 6
    );

    context.fillStyle = "#ffffff";

    context.fillRect(
      exit.x * cellSize + 7,
      exit.y * cellSize + 7,
      cellSize - 14,
      cellSize - 14
    );
  }

  function drawCursor() {
    const centerX =
      cursor.x * cellSize +
      cellSize / 2;

    const centerY =
      cursor.y * cellSize +
      cellSize / 2;

    context.fillStyle = "#ff0000";

    context.beginPath();

    context.arc(
      centerX,
      centerY,
      cellSize * 0.32,
      0,
      Math.PI * 2
    );

    context.fill();

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.stroke();
  }

  function restartMaze() {
    resizeCanvas();
    generateMaze();
    resetSolver();
    drawMaze();
  }

  function animate(time) {
    const currentStepInterval =
      mouseInside
        ? attractedStepInterval
        : normalStepInterval;

    if (
      !finished &&
      time - lastStepTime >=
        currentStepInterval
    ) {
      solveStep();
      lastStepTime = time;
    }

    drawMaze();

    animationFrame =
      requestAnimationFrame(animate);
  }

  function updateMousePosition(event) {
    const bounds =
      canvas.getBoundingClientRect();

    mouseX =
      event.clientX - bounds.left;

    mouseY =
      event.clientY - bounds.top;
  }

  canvas.addEventListener(
    "mouseenter",
    event => {
      mouseInside = true;
      updateMousePosition(event);
    }
  );

  canvas.addEventListener(
    "mousemove",
    event => {
      mouseInside = true;
      updateMousePosition(event);
    }
  );

  canvas.addEventListener(
    "mouseleave",
    () => {
      mouseInside = false;
    }
  );

  canvas.addEventListener(
    "click",
    () => {
      restartMaze();
    }
  );

  window.addEventListener(
    "resize",
    () => {
      restartMaze();
    }
  );

  restartMaze();

  if (animationFrame) {
    cancelAnimationFrame(
      animationFrame
    );
  }

  animationFrame =
    requestAnimationFrame(animate);
})();