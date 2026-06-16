// In your auth server routes (e.g., routes/userRoutes.js)
router.get("/get-user-by-id/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({where: { id },});
 console.log("Fetched user:", user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ phone: user.phone });
  } catch (err) {
    console.error("Error fetching user by ID:", err);
    return res.status(500).json({ message: "Internal error", error: err.message });
  }
});
