import ContactMessage from '../models/ContactMessage.js';

export const submitContactMessage = async (req, res) => {
  try {
    const { name, email, location = '', message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required.',
      });
    }

    const savedMessage = await ContactMessage.create({
      name,
      email,
      location,
      message,
    });

    return res.status(201).json({
      success: true,
      message: 'Your message was sent successfully.',
      contactMessage: savedMessage,
    });
  } catch (error) {
    console.error('Submit Contact Message Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
