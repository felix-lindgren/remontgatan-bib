
//Globals
var book_list;
var curr_book;
var add_res;
var isbn;
var title;
var author;
var id;
var sab;
var shelf;
var subject;
var fields;
var timeouts = [];

//Listeners


async function startup() {
    book_list = document.getElementById('book-list');
    add_res = document.getElementById("add-res");
    isbn = document.getElementById("isbn");
    title = document.getElementById("title");
    author = document.getElementById("author");
    id = document.getElementById("id");
    sab = document.getElementById("sab");
    shelf = document.getElementById("shelf");
    subject = document.getElementById("subject");
    fields = [isbn,title,author,id,sab,shelf,subject];

    get_books()

    document.getElementById('export_btn').addEventListener('click', hide_export,false);
}

async function make_table(t){
    var search_res = document.getElementById("search-res");
    search_res.innerText =  'Visar ' + t.length.toString() + ' av ' + books2.length + ' böcker';
    book_list.innerHTML = '<tr>' + '<th>' + 'Titel' + '</th>' + '<th>'+'Författare'+'</th>' + '<th>'+'Hylla'+'</th>'  + '</tr>';
    console.log("Create table")
    var indecies = [1,2,4]
    for (var i = 0; i < t.length; i++) {
        var row = document.createElement('tr');
        for (var j = 0; j < indecies.length; j++) {
            var cell = document.createElement('td');
            cell.textContent = t[i][indecies[j]];
            row.appendChild(cell);
        }
        book_list.appendChild(row);
    }
}




async function create_row(r){

    if(r){
    book_list.innerHTML +=
            '<tr id="' +r[4]+'">' +
                '<td>'+ '<div contenteditable="true" onkeyup="edit_field(this, 2)">' + r[1] +  '</div>' +'</td>' +
                '<td>'+ '<div contenteditable="true" onkeyup="edit_field(this, 3)">' + r[2] +  '</div>' +'</td>' +
                '<td>'+ '<div contenteditable="true" onkeyup="edit_field(this, 0)"> ' + r[4] +  '</div>' +'</td>' +
                //'<td>'+ '<div> ' + '<a href="http://libris.kb.se/bib/' + r[3]+ '" target="_blank">+</a>' +  '</div>' +'</td>' +
                
             '</tr>';
    }
}


async function get_books(){
    console.log(books2);
    
    make_table(books2);
}

async function search_book(){
    var term = document.getElementById("search").value;
    var res;
    if(term === ""){
        get_books();
        return
    } else if(term.indexOf("#") === 0){
        if(term.length > 1){
            cut_term = term.split('#')[1]
            console.log(cut_term);
            res = filterBooks(cut_term[0], 4);
            
        } else {
            get_books()
            return
        }
    } else {
        res = filterBooks(term, 1);
    }
    if(res === 0){
        make_table([]);
    } else {
        make_table(res);
    }
}

const filterBooks = (term, index) => {
    var res = []
    books2.forEach(row => {
        if(index === 4){
            if(row[index][0] === term[0].toUpperCase()) res.push(row)    
        } else {
            if(row[index].toUpperCase().includes(term.toUpperCase())) res.push(row)    
        }
        
    });
    return res
}

async function search_isbn(){
    var search = "";
    fields.forEach(field =>{
       search += field.value + " ";
    });

    book = await eel.search_isbn(search)();
    if(book === -1){return}
    curr_book = book;
    isbn.value = book["isbn"];
    title.value = book["title"];
    author.value = book["author"];
    id.value = book["id"];
    if(book["sab"] === "Saknas"){sab.style.backgroundColor = "red";} else {sab.style.backgroundColor = "white"}
    sab.value = book["sab"];
    shelf.value = book["shelf"];
    if(book["subject"] === "Saknas"){subject.style.backgroundColor = "red";} else {subject.style.backgroundColor = "white"}
    subject.value = book["subject"];
}

async function add_book() {
    var all_empty = true;
    for(var i=0;i<fields.length;i++){
        console.log(fields[i].value);
        if(fields[i].value !== "") all_empty = false;
    }
    if(all_empty) return;
    if (sab.value === "Saknas" || subject.value === "Saknas"){
            add_res.innerText = "Fyll i info.";
            add_res.style.backgroundColor = "red"
    } else{
        var book = {};
        book["isbn"] = isbn.value;
        book["title"] = title.value;
        book["author"] = author.value;
        book["id"] = id.value;
        book["sab"]= sab.value ;
        book["shelf"] = shelf.value ;
        book["subject"] = subject.value;

        if(await eel.add_book(book)()){

            add_res.innerText = "Inlagd";
            add_res.style.backgroundColor = "green";
            get_books();
            document.getElementById("isbn").select();
            clear_search();

        } else{

            add_res.innerText = "Boken finns redan";
            add_res.style.backgroundColor = "red"
        }
    }
}

function clear_search(){
    var isbn = document.getElementById("isbn");
    var title = document.getElementById("title");
    var author = document.getElementById("author");
    var id = document.getElementById("id");
    var sab = document.getElementById("sab");
    var shelf = document.getElementById("shelf");
    var subject = document.getElementById("subject");
    var fields = [isbn,title,author,id,sab,shelf,subject];
    fields.forEach((field) =>{
        field.value = "";
        field.style.backgroundColor = "white";
    })
}

async function save_file() {
    var export_author = document.getElementById("export_search").value;
    console.log(export_author);
    text = await eel.get_books_to_save(export_author)();
    console.log(text.value);
    filename = export_author+'-bocker.txt';
    download(filename,text);
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function hide_export() {
    var hidden = document.getElementById('export_panel').hidden;
    document.getElementById('export_panel').hidden = !hidden;
}