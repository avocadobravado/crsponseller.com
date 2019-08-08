// This shader is largely adapted from
// http://weber.itn.liu.se/~stegu/webglshadertutorial/shadertutorial.html

// I didn't want to dump all this shader code into the
// HTML, and it seems that putting them all in javascript,
// as text strings, was the easiest alternative.

var vShader = `
	attribute vec4 position;

	void main()
	{
		gl_Position = position;
	}
`

var fShader = `
	#ifdef GL_ES
		precision highp float;
	#endif
	#ifdef GL_OES_standard_derivatives
		#extension GL_OES_standard_derivatives : enable
	#endif
	const float PI = 3.1415926535897932384626433832795;

	uniform vec2 u_resolution;

	uniform float uScale; // For imperfect, isotropic anti-
	uniform float uYrot;  // aliasing in absence of dFdx()
	uniform float u_dotSize;

	uniform float u_time;
	uniform float u_frequency;
	uniform float u_amplitude;

	uniform float u_gradientAngle;
	uniform float u_gradientWidth;
	uniform float u_gridAngle;

	uniform vec4 bgColor1;
	uniform vec4 bgColor2;
	uniform vec4 dotColor1;
	uniform vec4 dotColor2;


	float lengthToNearestDot( vec2 pixelPosition )
	{
		// Before the grid was rotated 45 degrees, these
		// helped to make sure that the grid is centered.
		// They were added to pixelPosition, within the modulus operations.
		//float xOffset = mod( u_resolution.x, u_dotSize ) / 2.0;
		//float yOffset = mod( u_resolution.y, u_dotSize ) / 2.0;

		// Calculate distance on both axes to a range of -1.0 � 1.0.
		float distanceX = mod(pixelPosition.x - u_dotSize * 0.5, u_dotSize) / u_dotSize * 2.0 - 1.0;
		float distanceY = mod(pixelPosition.y - u_dotSize * 0.5, u_dotSize) / u_dotSize * 2.0 - 1.0;
		// 0.7 is a stand-in for half the square root of 2, which
		// is the distance from the center of a unit square to a corner.
		return sqrt( distanceX * distanceX + distanceY * distanceY ) * 0.7 * 0.95 + 0.025;
	}

	// The following method is used to avoid If-Else branches.
	// They are via http://theorangeduck.com/page/avoiding-shader-conditionals

	// Returns 1 if a and b are equal, 0 if not. 	
	float whenEqual( float a, float b )
	{
  		return 1.0 - abs( sign(a-b) );
	}

	float calculateGradientValue( )
	{
		// u_gradientWidth is a scalar value, so let's work with relative positions.
		vec2 gradientPosition = gl_FragCoord.xy / u_resolution.xy;
		// Offset so that the coords are pivoted at screen center.
		gradientPosition -= 0.5;
		// I want the vignetting to be strongest on the left and right sides, so
		// I calculate Y positions as being nearer to center than they really are.
		gradientPosition.y *= 0.8;
		// Undo the offset
        gradientPosition += 0.5;

		// Vignetting math
		float vignette = 1.0 - sqrt( pow( abs( gradientPosition.x - 0.5 ), 2.0 ) + pow( abs( gradientPosition.y - 0.5 ), 2.0 ));
        float gradientMinPos = 0.5 - u_gradientWidth * 0.5;
        
		return ( vignette - gradientMinPos ) / u_gradientWidth + 0.1;
	}

	float frequency = 30.0; // Needed globally for fallback version of aastep()
	float aastep(float threshold, float value)
	{
		#ifdef GL_OES_standard_derivatives
			float afwidth = 0.7 * length(vec2(dFdx(value), dFdy(value)));
		#else
			float afwidth = frequency * (1.0/200.0) / uScale / cos(uYrot);
		#endif
		return smoothstep(threshold - afwidth, threshold + afwidth, value);
	}

	void main()
	{
		float gradient = calculateGradientValue();

		float animation = sin( PI * 2.0 * u_time * u_frequency ) * u_amplitude;
		gradient = pow( clamp( gradient + animation, 0.0, 1.0 ), 2.0 );

		// Transform (rotate) the dot grid according to u_gridAngle
		float gridAngleRad = u_gridAngle * PI / 180.0;
		vec2 gridPosition = mat2( cos( gridAngleRad ),
								 -sin( gridAngleRad ),
								  sin(gridAngleRad),
								  cos( gridAngleRad )) * gl_FragCoord.xy;
		
		// Calculate the vertical gradients.
		float verticalGradient = clamp( (gl_FragCoord.y / u_resolution.y) * 1.2 - 0.1, 0.0, 1.0 );
		float toNearestDot = lengthToNearestDot( gridPosition );
		gl_FragColor = mix( mix( dotColor1, dotColor2, verticalGradient ), 
		                    mix( bgColor1, bgColor2, verticalGradient ), 
	                        aastep( 1.0 - gradient, toNearestDot ));
	}
`

// The rest of this file is pretty directly
// taken from the TWGL "tiniest example".
const gl = document.getElementById( "canvas" ).getContext( "webgl" );
var canvasStyle = window.getComputedStyle( document.getElementById( "canvas" ));
var dotStyle = window.getComputedStyle( document.getElementById( "dots" ));
const programInfo = twgl.createProgramInfo( gl, [vShader, fShader] );

// 3d vectors for six positions (composing a single quad)
const arrays = {
	position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
};
const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

// Convert an RGB(A) value (from CSS) to an array of scalar values.
function extractColor( cssValue )
{
	// Note that no hex conversion is necessary.
	// CSSStyleDeclaration already provides colors as RGB(A) strings.

	// This line extracts just the number values
	// via https://stackoverflow.com/a/1183906
	var array = cssValue.match(/\d+/g);
	return [array[0]/255, array[1]/255, array[2]/255, 1.0];
}

function render(time)
{
	twgl.resizeCanvasToDisplaySize(gl.canvas);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	const uniforms = {
		u_resolution: [gl.canvas.width, gl.canvas.height],
		// These two are used for the antialiasing step function.
		uScale: 7.5,
		uYrot: 1.0,
		// Size of each 'cell'
		u_dotSize: 28,
		// Don't adjust this one directly!
		u_time: time * 0.001,
		// Speed of the animation
		u_frequency: 0.1,
		// Size of the animation (how much of the screen it moves across)
		u_amplitude: 0.15,
		// Angle of the dot grid
		u_gridAngle: 0.0,
		// Angle of the gradient
		u_gradientAngle: 0.0,
		// Size of the gradient 'band' itself
		u_gradientWidth: 0.4,
		bgColor1: extractColor( canvasStyle.getPropertyValue('background-color')),
		bgColor2: extractColor( canvasStyle.getPropertyValue('color')),
		dotColor1: extractColor( dotStyle.getPropertyValue('background-color')),
		dotColor2: extractColor( dotStyle.getPropertyValue('color'))
	};

	gl.useProgram(programInfo.program);
	twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
	twgl.setUniforms(programInfo, uniforms);
	twgl.drawBufferInfo(gl, bufferInfo);

	requestAnimationFrame(render);
}
requestAnimationFrame(render);
