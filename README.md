
# BLOCKS Playground

This project is developed to provide a more friendly platform to develop programs for ROLI Lightpad Block / Lightpad M devices.

The webpage also acts as a Lightpad Block Simulator. The simulated pad can receive mouse / touch input events to test / play the Javascript code.

# Disclaimer

Please note that this is not an official ROLI application. This web application is developed by third-party developer.

### Features:

- Write code in Javascript
    
- Live preview (same with BLOCKS Code)
    
- Simulated Device Support: Show Bitmap LED & Perform touch events on web UI)
    
- Sample Code Catalog (and you can submit your awesome code to us if you like!)
    

### Known issues:

- Only 1 Lightpad device is supported.
    
- Unable to switch back to Simulated Lightpad after disconnecting real device.
    
- Sometimes error message is displayed but code executes successfully.
    

### Supported APIs:

(More API support coming soon)

- makeARGB(a, r, g, b)
    
- blendARGB(baseColor, overlaidColor)
    
- fillPixel(rgb, x, y)
    
- blendPixel(argb, x, y)
    
- fillRect(rgb, x, y, width, height)
    
- blendRect(argb, x, y, width, height)
    
- blendGradientRect(colorNW, colorNE, colorSW, colorSE, x, y, width, height)
    
- addPressurePoint(argb, touchX, touchY, touchZ)
    
- drawPressureMap()
    
- fadePressureMap()

### Supported Callback Functions:

(More API support coming soon)

- initialise()
    
- repaint()
    
- touchStart(touchIndex, x, y, vz)
    
- touchMove(touchIndex, x, y, vz)
    
- touchEnd(touchIndex, x, y, vz)
    
### For Feedback

(Report Problems, Suggestions or your awesome code)

Please provide your feedback here: [https://goo.gl/forms/Bw8nu2fYjmVWb4pe2](https://goo.gl/forms/Bw8nu2fYjmVWb4pe2)

### License

GPL 3.0