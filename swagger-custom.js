window.onload = function() {
    const ui = SwaggerUIBundle({
      url: "/docs/swagger.json",
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset
      ],
      layout: "StandaloneLayout"
    });
  
    const loginButton = document.createElement('button');
    loginButton.innerText = 'Login';
    loginButton.onclick = function() {
      const username = prompt('Enter Username:');
      const password = prompt('Enter Password:');
      if (username && password) {
        fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
          if (data.token) {
            ui.preauthorizeApiKey('bearerAuth', data.token);
          } else {
            alert('Login failed: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(err => {
          alert('Error: ' + err.message);
        });
      }
    };
  
    document.getElementById('swagger-ui').appendChild(loginButton);
  }
  