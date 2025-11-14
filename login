<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background-color: #f8f9fa;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 25px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    #error-message {
      display: none;
      color: red;
    }
  </style>
</head>
<body>
  
  <div class="card login-card">
    <div class="card-body">
      <h3 class="card-title text-center mb-4">تسجيل الدخول</h3>
      <div id="error-message" class="mb-3">كلمة المرور غير صحيحة</div>
      
      <div class="mb-3">
        <label for="password" class="form-label">كلمة المرور</label>
        <input type="password" class="form-control" id="password">
      </div>
      <button id="loginButton" class="btn btn-primary w-100">دخول</button>
    </div>
  </div>

  <script>
    document.getElementById("loginButton").addEventListener("click", function() {
      var pass = document.getElementById("password").value;
      if (!pass) return;

      this.disabled = true; // تعطيل الزر
      this.innerText = "جارٍ التحقق...";
      document.getElementById("error-message").style.display = "none";
      
      google.script.run
        .withSuccessHandler(function(success) {
          if (success) {
            // نجح! أعد تحميل الصفحة ليتم توجيهك
            window.location.reload();
          } else {
            document.getElementById("error-message").style.display = "block";
            document.getElementById("loginButton").disabled = false;
            document.getElementById("loginButton").innerText = "دخول";
          }
        })
        .withFailureHandler(function(err) {
          alert(err.message);
          document.getElementById("loginButton").disabled = false;
          document.getElementById("loginButton").innerText = "دخول";
        })
        .doLogin(pass);
    });
  </script>
</body>
</html>
