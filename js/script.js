const width = 1200, height = 600;
const margin = { top: 40, right: 30, bottom: 50, left: 60 };

let data, svg, xScale, yScale, line, color, xAxis, yAxis, tooltip, cursor, bisect;

async function createVisualization() {
    // Load and process data
    data = await d3.csv("data/all_mouse_cleaned.csv", d => ({
        minute: +d.Minute,
        activity: +d.Activity,
        sex: d.Sex,
        day: +d.Day
    }));

    // Initialize scales
    xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.minute))
        .range([margin.left, width - margin.right]);

    yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.activity)])
        .range([height - margin.bottom, margin.top]);

    // Initialize SVG
    svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Define line generator
    line = d3.line()
        .x(d => xScale(d.minute))
        .y(d => yScale(d.activity));

    color = d3.scaleOrdinal()
        .domain(["M", "F"])
        .range(["#1f77b4", "#e377c2"]);

    // Add axes
    xAxis = svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height - margin.bottom})`);

    yAxis = svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left},0)`);

    // Create tooltip
    tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", 1000);

    // Cursor line
    cursor = svg.append("line")
        .attr("class", "cursor")
        .style("stroke", "#333")
        .style("stroke-width", 1)
        .style("opacity", 0)
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);

    // Bisector for tooltip tracking
    bisect = d3.bisector(d => d.minute).left;

    // Update visualization
    updateVisualization("all");

    // Filter gender selection
    d3.select("#genderFilter").on("change", function () {
        updateVisualization(this.value);
    });
}

// Function to update chart based on selected gender
function updateVisualization(selectedGender) {
    let filteredData = data;

    if (selectedGender !== "all") {
        filteredData = data.filter(d => d.sex === selectedGender);
    }

    // Aggregate data
    const nested = d3.group(filteredData, d => d.sex, d => d.minute);
    const aggregated = Array.from(nested, ([sex, minutes]) => {
        return Array.from(minutes, ([minute, values]) => ({
            sex,
            minute,
            activity: d3.mean(values, d => d.activity)
        }));
    }).flat();

    // Update scales
    yScale.domain([0, d3.max(aggregated, d => d.activity)]);

    // Update axes
    xAxis.call(d3.axisBottom(xScale).tickFormat(d => `${d}m`));
    yAxis.call(d3.axisLeft(yScale));

    // Remove old lines before redrawing
    svg.selectAll(".line").remove();

    // Draw new lines
    svg.selectAll(".line")
        .data(d3.group(aggregated, d => d.sex))
        .join("path")
        .attr("class", "line")
        .attr("d", ([sex, data]) => line(data))
        .style("stroke", ([sex]) => color(sex))
        .style("fill", "none")
        .style("stroke-width", 2);

    // Remove old overlay before adding new one
    svg.selectAll(".overlay").remove();

    // Add mouse tracking overlay (AFTER drawing lines)
    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom)
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .style("opacity", 0)
        .style("pointer-events", "all")
        .on("mousemove", event => mousemove(event, aggregated))
        .on("mouseout", () => {
            tooltip.style("opacity", 0);
            cursor.style("opacity", 0);
        });
}

// Mousemove function for tooltips
function mousemove(event, aggregated) {
    const mouseX = d3.pointer(event)[0];
    const minute = xScale.invert(mouseX);

    cursor.attr("x1", mouseX)
        .attr("x2", mouseX)
        .style("opacity", 1);

    let tooltipHtml = `<strong>Minute: ${Math.round(minute)}</strong><br>`;

    d3.group(aggregated, d => d.sex).forEach((values, sex) => {
        const sorted = values.sort((a, b) => a.minute - b.minute);
        const i = bisect(sorted, minute, 0);
        const d0 = i > 0 ? sorted[i - 1] : null;
        const d1 = i < sorted.length ? sorted[i] : null;
        const d = !d0 ? d1 : !d1 ? d0 : minute - d0.minute > d1.minute - minute ? d1 : d0;

        if (d) {
            tooltipHtml += `${sex}: ${d.activity.toFixed(1)}<br>`;
        }
    });

    tooltip.html(tooltipHtml)
        .style("left", `${event.pageX + 15}px`)
        .style("top", `${event.pageY - 28}px`)
        .style("opacity", 1);
}

createVisualization();
