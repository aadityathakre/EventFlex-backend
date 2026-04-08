export default function handler(req, res) {
  try {
    res.status(200).json({
      success: true,
      message: "Backend is running!",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error.message
    });
  }
}
