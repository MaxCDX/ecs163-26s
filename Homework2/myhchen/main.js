const DATA_PATH = "data/pokemon_alopez247.csv";

// reusable fields
const BATTLE_STATS = ["hp", "attack", "defense", "spAtk", "spDef", "speed"];

// parse boolean strings
function toBoolean(value) {
  return value === "True";
}

// clean one row
function cleanPokemonRow(row) {
  // handle valid blanks
  const type2 = row.Type_2 === "" ? "None" : row.Type_2;
  const eggGroup2 = row.Egg_Group_2 === "" ? "None" : row.Egg_Group_2;
  const prMale = row.Pr_Male === "" ? null : Number(row.Pr_Male);

  // convert fields
  const cleaned = {
    number: Number(row.Number),
    name: row.Name,
    type1: row.Type_1,
    type2,
    total: Number(row.Total),
    hp: Number(row.HP),
    attack: Number(row.Attack),
    defense: Number(row.Defense),
    spAtk: Number(row.Sp_Atk),
    spDef: Number(row.Sp_Def),
    speed: Number(row.Speed),
    generation: Number(row.Generation),
    isLegendary: toBoolean(row.isLegendary),
    color: row.Color,
    hasGender: toBoolean(row.hasGender),
    prMale,
    eggGroup1: row.Egg_Group_1,
    eggGroup2,
    hasMegaEvolution: toBoolean(row.hasMegaEvolution),
    heightM: Number(row.Height_m),
    weightKg: Number(row.Weight_kg),
    catchRate: Number(row.Catch_Rate),
    bodyStyle: row.Body_Style,
  };

  const statValues = BATTLE_STATS.map((field) => cleaned[field]);

  // create derived fields
  cleaned.isDualType = cleaned.type2 !== "None";
  cleaned.catchDifficulty = 255 - cleaned.catchRate;
  cleaned.offense = cleaned.attack + cleaned.spAtk;
  cleaned.defenseScore = cleaned.defense + cleaned.spDef;
  cleaned.statSpread = Math.max(...statValues) - Math.min(...statValues);
  cleaned.stats = BATTLE_STATS.map((field) => ({
    stat: field,
    value: cleaned[field],
  }));

  return cleaned;
}

// data
function loadData() {
  return d3.csv(DATA_PATH).then((rows) => {
    const pokemon = rows.map(cleanPokemonRow);

    return pokemon;
  });
}

// sort types by count
function getTypesByCount(pokemon) {
  const typeCounts = d3
    .nest()
    .key((d) => d.type1)
    .rollup((rows) => rows.length)
    .entries(pokemon);

  return typeCounts
    .sort((a, b) => d3.descending(a.value, b.value) || d3.ascending(a.key, b.key))
    .map((d) => d.key);
}

// heatmap counts
function getTypeGenerationCounts(pokemon, generations, types) {
  const countMap = new Map();

  pokemon.forEach((d) => {
    const key = `${d.generation}-${d.type1}`;
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });

  return types.flatMap((type) =>
    generations.map((generation) => ({
      type,
      generation,
      count: countMap.get(`${generation}-${type}`) || 0,
    }))
  );
}

// color legend
function heatmapLegend(svg, colorScale, minValue, maxValue, x, y, height) {
  const legendWidth = 16;
  const legendId = "heatmap-legend-gradient";

  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", legendId)
    .attr("x1", "0%")
    .attr("y1", "100%")
    .attr("x2", "0%")
    .attr("y2", "0%");

  d3.range(0, 1.01, 0.1).forEach((t) => {
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorScale(minValue + t * (maxValue - minValue)));
  });

  const legend = svg.append("g").attr("transform", `translate(${x}, ${y})`);

  legend
    .append("text")
    .attr("class", "legend-title")
    .attr("x", 0)
    .attr("y", -12)
    .text("Count");

  legend
    .append("rect")
    .attr("class", "legend-gradient")
    .attr("width", legendWidth)
    .attr("height", height)
    .attr("fill", `url(#${legendId})`);

  legend
    .append("text")
    .attr("class", "legend-label")
    .attr("x", legendWidth + 8)
    .attr("y", 4)
    .text(maxValue.toFixed(0));

  legend
    .append("text")
    .attr("class", "legend-label")
    .attr("x", legendWidth + 8)
    .attr("y", height)
    .text(minValue.toFixed(0));
}

// draw heatmap
function typeGenerationHeatmap(pokemon) {
  const container = d3.select("#type-generation-heatmap");
  container.selectAll("*").remove();

  const margin = { top: 32, right: 54, bottom: 38, left: 78 };
  const outerWidth = container.node().clientWidth;
  const outerHeight = container.node().clientHeight;
  const width = outerWidth - margin.left - margin.right;
  const height = outerHeight - margin.top - margin.bottom;

  const generations = Array.from(new Set(pokemon.map((d) => d.generation))).sort((a, b) => a - b);
  const types = getTypesByCount(pokemon);
  const heatmapData = getTypeGenerationCounts(pokemon, generations, types);
  const maxCount = d3.max(heatmapData, (d) => d.count);

  // create SVG
  const svg = container
    .append("svg")
    .attr("width", outerWidth)
    .attr("height", outerHeight)
    .attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`)
    .attr("role", "img")
    .attr("aria-label", "Pokemon counts by generation and primary type");

  const chart = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // create scales
  const xScale = d3.scaleBand().domain(generations).range([0, width]).padding(0.02);
  const yScale = d3.scaleBand().domain(types).range([0, height]).padding(0.015);
  const colorScale = d3
    .scaleSequential((t) => d3.interpolateYlOrRd(0.08 + t * 0.9))
    .domain([0, maxCount]);

  const tooltip = d3.select("#tooltip");

  // title
  svg
    .append("text")
    .attr("class", "chart-title")
    .attr("x", margin.left + width / 2)
    .attr("y", 16)
    .attr("text-anchor", "middle")
    .text("Pokemon Counts by Generation and Primary Type");

  // axis
  chart
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale));

  chart.append("g").attr("class", "axis").call(d3.axisLeft(yScale));

  // axis labels
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left + width / 2)
    .attr("y", outerHeight - 10)
    .attr("text-anchor", "middle")
    .text("Generation");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", -(margin.top + height / 2))
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .text("Primary Type");

  // cells
  chart
    .selectAll("rect")
    .data(heatmapData)
    .enter()
    .append("rect")
    .attr("class", "heatmap-cell")
    .attr("x", (d) => xScale(d.generation))
    .attr("y", (d) => yScale(d.type))
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", (d) => colorScale(d.count))
    .on("mouseover", function (d) {
      d3.select(this).attr("stroke", "#263238").attr("stroke-width", 2);
      tooltip
        .style("display", "block")
        .html(`<strong>${d.type}</strong><br>Generation: ${d.generation}<br>Count: ${d.count}`);
    })
    .on("mousemove", function () {
      tooltip.style("left", `${d3.event.pageX + 12}px`).style("top", `${d3.event.pageY + 12}px`);
    })
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 1);
      tooltip.style("display", "none");
    });

  heatmapLegend(svg, colorScale, 0, maxCount, margin.left + width + 16, margin.top, 128);
}

// Start data loading
if (typeof document !== "undefined") {
  loadData()
    .then((pokemon) => {
      typeGenerationHeatmap(pokemon);
    })
    .catch((error) => {
      console.error("Failed to load Pokemon data:", error);
    });
}
