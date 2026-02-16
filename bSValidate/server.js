import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import FormData from "form-data";
import cors from "cors";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

const BASE_URL = "https://dev.validate.buildingsmart.org/api/v1";
const TOKEN = process.env.BUILDINGSMART_TOKEN;

if (!TOKEN) {
  console.error("Missing BUILDINGSMART_TOKEN");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

app.get("/", (_, res) => {
  res.send("IFC Validation Backend running");
});

// POST request to submit an IFC file for validation
app.post("/api/validate", upload.single("file"), async (req, res) => {
  try {
    console.log("\nValidation request received");

    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({ error: "No IFC file uploaded" });
    }

    console.log(`File: ${req.file.originalname}`);
    console.log(`Size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    const formData = new FormData();

    formData.append("file_name", req.file.originalname);
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: "application/octet-stream",
    });

    console.log("Sending file to buildingSMART API");

    const { data } = await axios.post(
      `${BASE_URL}/validationrequest`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Token ${TOKEN}`,
        },
        maxBodyLength: Infinity,
      },
    );

    console.log("Validation job created");
    console.log("Job ID:", data.public_id);

    res.json({
      jobId: data.public_id,
      status: data.status,
    });
  } catch (err) {
    console.error("Validation submission failed");
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Failed to submit validation",
      details: err.response?.data,
    });
  }
});

//Get request to fetch validation results for a given job ID
app.get("/api/results/:jobId", async (req, res) => {
  const { jobId } = req.params;

  try {
    console.log(`\nFetching results for Job: ${jobId}`);

    const statusRes = await axios.get(
      `${BASE_URL}/validationrequest/${jobId}`,
      { headers: { Authorization: `Token ${TOKEN}` } },
    );

    // Fetch all results with pagination
    let allResults = [];
    let offset = 0;
    const limit = 100;
    let total = 0;

    // First request to get total count
    const firstRes = await axios.get(`${BASE_URL}/validationoutcome`, {
      params: {
        request_public_id: jobId,
        offset: 0,
        limit: limit,
      },
      headers: { Authorization: `Token ${TOKEN}` },
    });

    total = firstRes.data.metadata?.result_set?.total || 0;
    allResults = firstRes.data.results || [];

    console.log(`Total results available: ${total}`);
    console.log(`First batch received: ${allResults.length}`);

    // Log sample result structure
    if (allResults.length > 0) {
      console.log('\n=== BUILDINGSMART API RESULTS STRUCTURE ===');
      console.log('Sample result fields:', Object.keys(allResults[0]));
      console.log('Sample result (full):', JSON.stringify(allResults[0], null, 2));
      console.log('\n=== KEY FIELDS EXTRACTION ===');
      console.log('- public_id:', allResults[0].public_id);
      console.log('- feature:', allResults[0].feature);
      console.log('- severity:', allResults[0].severity);
      console.log('- outcome_code:', allResults[0].outcome_code);
      console.log('- instance_public_id:', allResults[0].instance_public_id);
      console.log('- expected:', allResults[0].expected);
      console.log('- observed:', allResults[0].observed);
      console.log('- msg (if exists):', allResults[0].msg || 'NOT PRESENT');
      console.log('==========================================\n');

      // Check observed/expected fields for schema errors
      const firstSchemaError = allResults.find(r =>
        r.feature && typeof r.feature === 'string' &&
        (r.feature.includes('entity_rule') || r.feature.includes('IfcBuildingElement'))
      );

      if (firstSchemaError) {
        console.log('\n=== SCHEMA ERROR OBSERVED/EXPECTED FIELDS ===');
        console.log('Schema error public_id:', firstSchemaError.public_id);
        console.log('Feature:', firstSchemaError.feature);
        console.log('Instance public_id:', firstSchemaError.instance_public_id);
        console.log('\n--- EXPECTED FIELD ---');
        if (firstSchemaError.expected) {
          console.log('Type:', typeof firstSchemaError.expected);
          if (typeof firstSchemaError.expected === 'string') {
            console.log('Length:', firstSchemaError.expected.length);
            console.log('Content preview (first 500 chars):', firstSchemaError.expected.substring(0, 500));
            console.log('Content full:', firstSchemaError.expected);
          } else {
            console.log('Content:', JSON.stringify(firstSchemaError.expected, null, 2));
          }
        } else {
          console.log('Expected is NULL');
        }

        console.log('\n--- OBSERVED FIELD ---');
        if (firstSchemaError.observed) {
          console.log('Type:', typeof firstSchemaError.observed);
          if (typeof firstSchemaError.observed === 'string') {
            console.log('Length:', firstSchemaError.observed.length);
            console.log('Content preview (first 500 chars):', firstSchemaError.observed.substring(0, 500));
            console.log('Content full:', firstSchemaError.observed);
          } else {
            console.log('Content:', JSON.stringify(firstSchemaError.observed, null, 2));
          }
        } else {
          console.log('Observed is NULL');
        }
        console.log('=============================================\n');
      }
    }

    // Fetch remaining pages if needed
    while (allResults.length < total) {
      offset += limit;
      console.log(`Fetching batch at offset ${offset}...`);

      const pageRes = await axios.get(`${BASE_URL}/validationoutcome`, {
        params: {
          request_public_id: jobId,
          offset: offset,
          limit: limit,
        },
        headers: { Authorization: `Token ${TOKEN}` },
      });

      const pageResults = pageRes.data.results || [];
      allResults = allResults.concat(pageResults);
      console.log(`Received ${pageResults.length} more results, total: ${allResults.length}`);

      if (pageResults.length === 0) break; // No more results
    }

    console.log(`Status: ${statusRes.data.status}`);
    console.log(`Final results count: ${allResults.length}/${total}`);

    // Fetch validation tasks to categorize results (Normative vs Industry Practices)
    console.log('\n=== FETCHING VALIDATION TASKS ===');
    let tasks = [];
    try {
      const tasksRes = await axios.get(`${BASE_URL}/validationtask`, {
        params: {
          request_public_id: jobId,
          limit: 100
        },
        headers: { Authorization: `Token ${TOKEN}` }
      });

      tasks = tasksRes.data.results || [];
      console.log(`Found ${tasks.length} validation tasks`);

      // Create mapping of task_id → task_type
      const taskTypeMap = {};
      tasks.forEach(task => {
        taskTypeMap[task.public_id] = task.type;
        console.log(`- Task ${task.public_id}: ${task.type} (${task.status})`);
      });

      // Add task type to each result
      allResults.forEach(result => {
        if (result.validation_task_public_id) {
          result.task_type = taskTypeMap[result.validation_task_public_id];
        }
      });

      console.log('\n✅ Task types added to results');

      // DEBUG: Show sample results with task_type
      const taskTypeDistribution = {};
      allResults.forEach(result => {
        const taskType = result.task_type || 'NONE';
        taskTypeDistribution[taskType] = (taskTypeDistribution[taskType] || 0) + 1;
      });
      console.log('Task type distribution in results:', taskTypeDistribution);
      console.log('Sample result with task_type:', allResults.slice(0, 3).map(r => ({
        feature: r.feature,
        task_type: r.task_type,
        validation_task_public_id: r.validation_task_public_id
      })));
    } catch (taskErr) {
      console.log('⚠️ Could not fetch tasks:', taskErr.message);
    }
    console.log('=====================================\n');

    console.log('\n=== SENDING TO FRONTEND ===');
    console.log('Response structure:', {
      jobId,
      status: statusRes.data.status,
      resultsCount: allResults.length,
      totalResults: total,
      sampleKeys: allResults.length > 0 ? Object.keys(allResults[0]) : []
    });
    console.log('============================\n');

    res.json({
      jobId,
      status: statusRes.data.status,
      outcome: {
        ...firstRes.data,
        results: allResults,
        metadata: {
          result_set: {
            total: total,
            count: allResults.length,
            page_size: limit,
            offset: 0,
            limit: total,
          },
        },
      },
    });
  } catch (err) {
    console.error("Failed to fetch results");
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Failed to fetch results",
    });
  }
});

// Get request to fetch validation tasks for a given job ID
// Shows detailed progress of each validation type (syntax, schema, normative rules, etc.)
app.get("/api/tasks/:jobId", async (req, res) => {
  const { jobId } = req.params;

  try {
    console.log(`\nFetching tasks for Job: ${jobId}`);

    // Fetch tasks filtered by request_public_id
    const tasksRes = await axios.get(`${BASE_URL}/validationtask`, {
      params: {
        request_public_id: jobId,
        limit: 100 // Typically there are <20 tasks per validation
      },
      headers: { Authorization: `Token ${TOKEN}` },
    });

    const tasks = tasksRes.data.results || [];
    console.log(`Found ${tasks.length} validation tasks`);

    // Log task types and statuses for debugging
    if (tasks.length > 0) {
      console.log('=== VALIDATION TASKS ===');
      tasks.forEach(task => {
        console.log(`- ${task.type}: ${task.status}${task.progress ? ` (${task.progress}%)` : ''}`);
      });
      console.log('========================');
    }

    res.json({
      jobId,
      tasks,
      metadata: tasksRes.data.metadata || null
    });
  } catch (err) {
    console.error("Failed to fetch tasks");
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Failed to fetch validation tasks",
      details: err.response?.data,
    });
  }
});

// DELETE request to cancel a running validation
app.delete("/api/validate/:jobId", async (req, res) => {
  const { jobId } = req.params;

  try {
    console.log(`\nCancelling validation for Job: ${jobId}`);

    const deleteRes = await axios.delete(
      `${BASE_URL}/validationrequest/${jobId}`,
      {
        headers: { Authorization: `Token ${TOKEN}` },
      }
    );

    console.log(`Validation ${jobId} cancelled successfully`);

    res.status(204).send(); // No content response
  } catch (err) {
    console.error("Failed to cancel validation");
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Failed to cancel validation",
      details: err.response?.data,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
