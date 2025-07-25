var express = require("express");
var router = express.Router();
const {
  sequelize,
  User,
  Video,
  Action,
  // CompetitionContract,
  ContractLeagueTeam,
  Complex,
  // GroupContract,
  ContractTeamUser,
  League,
  // Match,
  Session,
  OpponentServeTimestamp,
  Player,
  // PlayerContract,
  ContractTeamPlayer,
  Point,
  Script,

  ContractVideoAction,
  Team,
} = require("kybervision17db");
const models = {
  User,
  Video,
  Action,
  // CompetitionContract,
  ContractLeagueTeam,
  Complex,
  // GroupContract,
  ContractTeamUser,
  League,
  // Match,
  Session,
  OpponentServeTimestamp,
  Player,
  // PlayerContract,
  ContractTeamPlayer,
  Point,
  Script,
  // SyncContract,
  // ContractScriptVideo,
  ContractVideoAction,
  Team,
};

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
// const archiver = require("archiver");
// const { Parser } = require("json2csv");
const mkdirAsync = promisify(fs.mkdir);
const { authenticateToken } = require("../modules/userAuthentication");
const unlinkAsync = promisify(fs.unlink);
const {
  readAndAppendDbTables,
  createDatabaseBackupZipFile,
} = require("../modules/adminDb");

// upload data to database
const multer = require("multer");
const unzipper = require("unzipper");
const upload = multer({
  dest: path.join(process.env.PATH_PROJECT_RESOURCES, "uploads-delete-ok/"),
}); // Temporary storage for file uploads

// GET /admin-db/table/:tableName
router.get("/table/:tableName", authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    console.log(`- in GET /admin-db/table/${tableName}`);

    if (!models[tableName]) {
      return res
        .status(400)
        .json({ result: false, message: `Table '${tableName}' not found.` });
    }

    let tableData = await models[tableName].findAll({ raw: true });

    if (tableData.length === 0) {
      const attributes = Object.keys(models[tableName].rawAttributes);
      const dummyRow = {};
      attributes.forEach((attr) => {
        dummyRow[attr] = null;
      });
      tableData = [dummyRow];
    }

    res.json({ result: true, data: tableData });
  } catch (error) {
    console.error("Error fetching table data:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});
// router.get("/table/:tableName", authenticateToken, async (req, res) => {
//   try {
//     const { tableName } = req.params;
//     console.log(`- in GET /admin-db/table/${tableName}`);

//     // Check if the requested table exists in the models
//     if (!models[tableName]) {
//       return res
//         .status(400)
//         .json({ result: false, message: `Table '${tableName}' not found.` });
//     }

//     // Fetch all records from the table
//     const tableData = (await models[tableName].findAll()) || [];
//     // console.log(`Fetched data from ${tableName}:`, tableData);

//     res.json({ result: true, data: tableData });
//   } catch (error) {
//     console.error("Error fetching table data:", error);
//     res.status(500).json({
//       result: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// });

router.get("/create-database-backup", authenticateToken, async (req, res) => {
  console.log(`- in GET /admin-db/create-database-backup`);

  try {
    const zipFilePath = await createDatabaseBackupZipFile();
    console.log(`Backup zip created: ${zipFilePath}`);

    res.json({
      result: true,
      message: "Database backup completed",
      backupFile: zipFilePath,
    });
  } catch (error) {
    console.error("Error creating database backup:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 Get Database Backup List (GET /admin-db/backup-database-list)
router.get("/backup-database-list", authenticateToken, async (req, res) => {
  console.log(`- in GET /admin-db/backup-database-list`);

  try {
    const backupDir = process.env.PATH_DB_BACKUPS;
    if (!backupDir) {
      return res
        .status(500)
        .json({ result: false, message: "Backup directory not configured." });
    }

    // Read files in the backup directory
    const files = await fs.promises.readdir(backupDir);

    // Filter only .zip files
    const zipFiles = files.filter((file) => file.endsWith(".zip"));

    // console.log(`Found ${zipFiles.length} backup files.`);

    res.json({ result: true, backups: zipFiles });
  } catch (error) {
    console.error("Error retrieving backup list:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/send-db-backup/:filename", authenticateToken, async (req, res) => {
  console.log(`- in GET /admin-db/send-db-backup/${req.params.filename}`);

  try {
    const { filename } = req.params;
    const backupDir = process.env.PATH_DB_BACKUPS;

    if (!backupDir) {
      return res
        .status(500)
        .json({ result: false, message: "Backup directory not configured." });
    }

    const filePath = path.join(backupDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ result: false, message: "File not found." });
    }

    console.log(`Sending file: ${filePath}`);
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(500).json({ result: false, message: "Error sending file." });
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/db-row-counts-by-table", authenticateToken, async (req, res) => {
  console.log(`- in GET /admin-db/db-row-counts-by-table`);

  try {
    let arrayRowCountsByTable = [];

    for (const tableName in models) {
      console.log(`Checking table: ${tableName}`);
      if (models.hasOwnProperty(tableName)) {
        // console.log(`Checking table: ${tableName}`);

        // Count rows in the table
        const rowCount = await models[tableName].count();

        arrayRowCountsByTable.push({
          tableName,
          rowCount: rowCount || 0, // Ensure it's 0 if empty
        });
      }
    }

    // console.log(`Database row counts by table:`, arrayRowCountsByTable);
    res.json({ result: true, arrayRowCountsByTable });
  } catch (error) {
    console.error("Error retrieving database row counts:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.post(
  "/import-db-backup",
  authenticateToken,
  upload.single("backupFile"),
  async (req, res) => {
    console.log("- in POST /admin-db/import-db-backup");

    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ result: false, message: "No file uploaded." });
      }

      const backupDir = process.env.PATH_PROJECT_RESOURCES;
      if (!backupDir) {
        console.log("*** no file ***");
        return res.status(500).json({
          result: false,
          message: "Temporary directory not configured.",
        });
      }

      const tempExtractPath = path.join(backupDir, "temp_db_import");

      // Ensure the temp_db_import folder is clean before extracting
      if (fs.existsSync(tempExtractPath)) {
        console.log("Previous temp_db_import folder found. Deleting...");
        await fs.promises.rm(tempExtractPath, { recursive: true });
        console.log("Old temp_db_import folder deleted.");
      }

      await mkdirAsync(tempExtractPath, { recursive: true });

      console.log(`Extracting backup to: ${tempExtractPath}`);

      // Unzip the uploaded file
      await fs
        .createReadStream(req.file.path)
        .pipe(unzipper.Extract({ path: tempExtractPath }))
        .promise();

      console.log("Backup extracted successfully.");

      // Read all subfolders inside tempExtractPath
      const extractedFolders = await fs.promises.readdir(tempExtractPath);

      // Find the correct folder that starts with "db_backup_"
      let backupFolder = extractedFolders.find(
        (folder) => folder.startsWith("db_backup_") && folder !== "__MACOSX"
      );

      // Determine the path where CSV files should be searched
      let backupFolderPath = backupFolder
        ? path.join(tempExtractPath, backupFolder)
        : tempExtractPath;

      console.log(`Using backup folder: ${backupFolderPath}`);

      // Call the new function to read and append database tables
      const status = await readAndAppendDbTables(backupFolderPath);

      // Clean up temporary files
      await fs.promises.rm(tempExtractPath, { recursive: true });
      await fs.promises.unlink(req.file.path);
      // await fs.promises.rm(
      //   path.join(process.env.PATH_PROJECT_RESOURCES, "uploads/"),
      //   { recursive: true }
      // );
      console.log("Temporary files deleted.");

      console.log(status);
      if (status?.failedOnTableName) {
        res.status(500).json({
          result: false,
          error: status.error,
          failedOnTableName: status.failedOnTableName,
        });
      } else {
        res.json({
          result: status.success,
          message: status.message,
        });
      }
    } catch (error) {
      console.error("Error importing database backup:", error);
      res.status(500).json({
        result: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.delete(
  "/delete-db-backup/:filename",
  authenticateToken,
  async (req, res) => {
    console.log(
      `- in DELETE /admin-db/delete-db-backup/${req.params.filename}`
    );

    try {
      const { filename } = req.params;
      const backupDir = process.env.PATH_DB_BACKUPS;

      if (!backupDir) {
        return res
          .status(500)
          .json({ result: false, message: "Backup directory not configured." });
      }

      const filePath = path.join(backupDir, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res
          .status(404)
          .json({ result: false, message: "File not found." });
      }

      // Delete the file
      await fs.promises.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);

      res.json({ result: true, message: "Backup file deleted successfully." });
    } catch (error) {
      console.error("Error deleting backup file:", error);
      res.status(500).json({
        result: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

// 🔹 DELETE route to remove the entire database
router.delete("/the-entire-database", authenticateToken, async (req, res) => {
  console.log("- in DELETE /admin-db/the-entire-database");

  try {
    // Create a backup before deletion
    console.log("Creating database backup before deletion...");
    const backupPath = await createDatabaseBackupZipFile(
      (suffix = "_last_before_db_delete")
    );
    console.log(`Backup created at: ${backupPath}`);

    // Get database path and name from environment variables
    const dbPath = process.env.PATH_DATABASE;
    const dbName = process.env.NAME_DB;
    const fullDbPath = path.join(dbPath, dbName);

    // Check if the database file exists
    if (!fs.existsSync(fullDbPath)) {
      return res.status(404).json({
        result: false,
        message: "Database file not found.",
      });
    }

    // Delete the database file
    await unlinkAsync(fullDbPath);
    console.log(`Database file deleted: ${fullDbPath}`);

    res.json({
      result: true,
      message: "Database successfully deleted.",
      backupFile: backupPath,
    });
  } catch (error) {
    console.error("Error deleting the database:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
});

// 🔹 DELETE route to remove a specific table
router.delete("/table/:tableName", authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    console.log(`- in DELETE /admin-db/table/${tableName}`);

    // Check if the requested table exists in the models
    if (!models[tableName]) {
      return res
        .status(400)
        .json({ result: false, message: `Table '${tableName}' not found.` });
    }

    // Delete all records from the table
    await models[tableName].destroy({ where: {}, truncate: true });

    res.json({
      result: true,
      message: `Table '${tableName}' has been deleted.`,
    });
  } catch (error) {
    console.error("Error deleting table:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 GET /admin-db/table-clean/:tableName : route to clean a specific table
router.get("/table-clean/:tableName", authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    console.log(`- in GET /admin-db/table-clean/${tableName}`);

    // Check if the requested table exists in the models
    if (!models[tableName]) {
      return res
        .status(400)
        .json({ result: false, message: `Table '${tableName}' not found.` });
    }

    // Fetch all records from the table
    const tableData = (await models[tableName].findAll({ raw: true })) || [];
    // console.log(`----Fetched data from ${tableName} ----`);
    // console.log(tableData);
    res.json({ result: true, data: tableData });
  } catch (error) {
    console.error("Error fetching table data:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// DELETE /table-row/:tableName/:rowId : route to delete a specific row from a table
router.delete(
  "/table-row/:tableName/:rowId",
  authenticateToken,
  async (req, res) => {
    try {
      const { tableName, rowId } = req.params;
      console.log(`- in DELETE /admin-db/table-row/${tableName}/${rowId}`);

      // Check if the requested table exists in the models
      if (!models[tableName]) {
        return res
          .status(400)
          .json({ result: false, message: `Table '${tableName}' not found.` });
      }

      // Delete the specific row from the table
      await models[tableName].destroy({ where: { id: rowId } });

      res.json({
        result: true,
        message: `Row ${rowId} from table '${tableName}' has been deleted.`,
      });
    } catch (error) {
      console.error("Error deleting row:", error);
      res.status(500).json({
        result: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

// 🔹 PUT /admin-db/table-row/:tableName/:rowId : route to update a specific row from a table
router.put(
  "/table-row/:tableName/:rowId",
  authenticateToken,
  async (req, res) => {
    try {
      const { tableName, rowId } = req.params;
      const dataToSave = req.body;
      console.log(`- in PUT /admin-db/table-row/${tableName}/${rowId}`);
      console.log("Incoming data:", dataToSave);

      // Validate table
      if (!models[tableName]) {
        return res
          .status(400)
          .json({ result: false, message: `Table '${tableName}' not found.` });
      }

      const Model = models[tableName];

      let result;

      if (!rowId || rowId === "null" || rowId === "undefined") {
        // ➕ Create new record
        result = await Model.create(dataToSave);
      } else {
        // 🔁 Update existing record
        const [rowsUpdated] = await Model.update(dataToSave, {
          where: { id: rowId },
        });

        if (rowsUpdated === 0) {
          return res.status(404).json({
            result: false,
            message: `No record found with id ${rowId} in table '${tableName}'.`,
          });
        }

        result = await Model.findByPk(rowId); // Return updated record
      }

      return res.json({
        result: true,
        message: `Row ${
          rowId || result.id
        } in '${tableName}' successfully saved.`,
        // data: result,
      });
    } catch (error) {
      console.error("Error saving row:", error);
      return res.status(500).json({
        result: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
