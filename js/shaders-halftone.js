// This shader is largely adapted from 
// http://weber.itn.liu.se/~stegu/webglshadertutorial/shadertutorial.html

// I didn't want to dump all this shader code into the 
// HTML, and it seemed that putting them all in javascript, 
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
	
	uniform vec4 bgColor;
	uniform vec4 dotColor;
	
	
	float lengthToNearestDot( vec2 pixelPosition )
	{
		// Before the grid was rotated 45 degrees, these
		// helped to make sure that the grid is centered.
		// They were added to pixelPosition, within the modulus operations.
		//float xOffset = mod( u_resolution.x, u_dotSize ) / 2.0;
		//float yOffset = mod( u_resolution.y, u_dotSize ) / 2.0;
	
		// Calculate distance on both axes to a range of -1.0 — 1.0.
		float distanceX = mod(pixelPosition.x, u_dotSize) / u_dotSize * 2.0 - 1.0;
		float distanceY = mod(pixelPosition.y, u_dotSize) / u_dotSize * 2.0 - 1.0;
		// 0.7 is a stand-in for half the square root of 2, which 
		// is the distance from the center of a unit square to a corner.
		return sqrt( distanceX * distanceX + distanceY * distanceY ) * 0.7;
	}
	
	// Returns 1 if x and y are equal, 0 if not. Used to avoid If-Else.
	// via http://theorangeduck.com/page/avoiding-shader-conditionals
	float whenEqual( float a, float b )
	{
  		return 1.0 - abs( sign(a - b));
	}

	float calculateGradientValue( )
	{
		// u_gradientWidth is a scalar value, so let's work with relative positions.
		vec2 gradientPosition = gl_FragCoord.xy / u_resolution.xy;
		// Offset so that the coords are pivoted at screen center.
		gradientPosition -= 0.5;
		
		// Transform (rotate) gradient value according to u_gradientAngle
		float gradientRadians = u_gradientAngle * PI / 180.0;
		gradientPosition = mat2( cos( gradientRadians ), 
								-sin( gradientRadians ), 
								 sin(gradientRadians), 
								 cos( gradientRadians )) * gradientPosition;
		// Revert that previous offset.
		gradientPosition += 0.5;
		
		// Vignetting
		float screenSizeMax = max( u_resolution.x, u_resolution.y );
		float vignette = 1.0 - sqrt( pow( abs( gradientPosition.x - 0.5 ), 2.0 ) + pow( abs( gradientPosition.y - 0.5 ), 2.0 ));
		
		// Determine if screen is smallest on x or y axis.
		float screenSize = min( u_resolution.x, u_resolution.y );
		// Use that to determine which element of our position is relevant.
		float gradient = gradientPosition.x * whenEqual( screenSize, u_resolution.x ) + 
						 gradientPosition.y * whenEqual( screenSize, u_resolution.y );
		float gradientMinPos = 0.5 - u_gradientWidth * 0.5;
		return ( gradient - gradientMinPos ) / u_gradientWidth;
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
		gradient = clamp( gradient + animation, 0.0, 1.0 );
		
		//gl_FragColor = vec4( gradient, gradient, gradient, 1.0 );
		//return;
		
		// Transform (rotate) the dot grid according to u_gridAngle
		float gridAngleRad = u_gridAngle * PI / 180.0;
		vec2 gridPosition = mat2( cos( gridAngleRad ), 
								 -sin( gridAngleRad ), 
								  sin(gridAngleRad), 
								  cos( gridAngleRad )) * gl_FragCoord.xy;
		
		float toNearestDot = lengthToNearestDot( gridPosition );
		float radius = sqrt( 1.0 - gradient );
		vec4 fragcolor = mix( dotColor, bgColor, aastep( 1.0 - gradient, toNearestDot ));
		gl_FragColor = vec4( fragcolor );
	}
`

// The rest of this file is pretty directly 
// taken from the TWGL "tiniest example".
const gl = document.getElementById( "canvas" ).getContext( "webgl" );
const programInfo = twgl.createProgramInfo( gl, [vShader, fShader] );

// 3d vectors for six positions (composing a single quad)
const arrays = {
	position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
};
const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

function render(time)
{
	twgl.resizeCanvasToDisplaySize(gl.canvas);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	const uniforms = {
		u_resolution: [gl.canvas.width, gl.canvas.height],
		// These two are used for the antialiasing step function.
		uScale: 10.0,
		uYrot: 1.0,
		// Size of each 'cell'
		u_dotSize: 32,
		// Don't adjust this one directly.
		u_time: time * 0.001,
		// Speed of the animation
		u_frequency: 0.05,
		// Size of the animation (how much of the screen it moves across)
		u_amplitude: 0.5,
		// Angle of the dot grid
		u_gridAngle: 45.0,
		// Angle of the gradient
		u_gradientAngle: 0.0,
		// Scalar value determine 
		u_gradientWidth: 0.333333,
		bgColor:     [0.5, 1.0, 0.75, 1.0],
		dotColor:    [0.5, 0.5, 1.0, 1.0]
	};

	gl.useProgram(programInfo.program);
	twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
	twgl.setUniforms(programInfo, uniforms);
	twgl.drawBufferInfo(gl, bufferInfo);

	requestAnimationFrame(render);
}
requestAnimationFrame(render);